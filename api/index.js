const express = require("express");
const app = express();
const passport = require("passport");
const session = require("express-session");
const cors = require("cors");
const GitHubStrategy = require("passport-github2").Strategy;
const userRouter = require("./db/routes/userRouter");
const utilFunctions = require("./db/utilFunctions");
const Config = require("./db/config.js");
const bodyParser = require("body-parser");
const User = require("./db/models/User.js");
const Account = require("./db/models/Account.js");
const Login = require("./db/models/Login.js");

app.use(cors());
app.use(bodyParser.json());
app.set("port", process.env.PORT || Config.PORT);
app.use(userRouter);
app.listen(app.get("port"), () => {
  console.log(` PORT: ${app.get("port")} `);
});

function ensureAuthenticated(req, res, next) {
  //console.log("ik",req.user);

  res.json({});
  if (req.isAuthenticated()) {
    return next();
  }
  //res.redirect(`${Config.FRONTEND_URL}`);
}

passport.serializeUser(function (user, done) {
  done(null, user);
});
passport.deserializeUser(function (obj, done) {
  done(null, obj);
});

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Methods", "POST,GET,PATCH,PUT,DELETE");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Origin", `${Config.FRONTEND_URL}`);
  next();
});

passport.use(
  new GitHubStrategy(
    {
      clientID: Config.GITHUB_CLIENT_ID,
      clientSecret: Config.GITHUB_CLIENT_SECRET,
      callbackURL: Config.GITHUB_CALLBACK_URL,
    },
    function (accessToken, refreshToken, profile, done) {
      // asynchronous verification, for effect...

      utilFunctions.checkUserOrSave(profile, done);
    }
  )
);
app.use(
  session({ secret: "keyboard cat", resave: false, saveUninitialized: false })
);
app.use(passport.initialize());
app.use(passport.session());

app.get("/", (req, res) => {
  res.send("<a href='/secret'>Access Secret Area</a>");
});

app.get("/login", (req, res) => {
  //   res.send("<a href='/auth/github'>Sign in With GitHub</a>");
  res.redirect("/auth/github");
});

app.get(
  "/auth/github",
  passport.authenticate("github", { scope: ["read:user"] }), /// Note the scope here
  function (req, res) {}
);

app.get(
  "/auth/github/callback",
  passport.authenticate("github", {
    failureRedirect: "/logout",
  }),
  function (req, res) {
    res.redirect(`${Config.FRONTEND_URL}/`);
  }
);

app.get("/sessioncheck", (req, res) => {
  if (
    ("passportauth", passport.authenticate("github", { scope: ["read:user"] }))
  ) {
    console.log(req);
    res.json(req.user);
  } else {
    console.log(req);
    res.json({ auth: false });
  }
});

app.get("/user", function (req, res) {
  console.log("callback");
  console.log(res);
  res.redirect(`${Config.FRONTEND_URL}/user`);
});

app.get("/logout", function (req, res) {
  req.logout();
  res.redirect(`${Config.FRONTEND_URL}`);
});

// app.get("/users", (req, res) => {
//   if (req.isAuthenticated()) {
//     User.find()
//       .populate("Login")
//       .populate("Account")
//       .then((user) => {
//         user.sort(() => Math.random() - 0.5);
//         res.json(user);
//       });
//   } else {
//     res.redirect(`${Config.FRONTEND_URL}`);
//   }
// });

app.get("/users", (req, res) => {
  if (req.isAuthenticated()) {
    User.findOne({ _id: req.user._id })
      .populate("Account")
      .then((user) => {
        User.find({ _id: { $ne: req.user._id } })
          .populate("Login")
          .populate("Account")
          .then((users) => {
            let matched = [];
            let liked = [];

            matched = user.Account.MatchedUsers.slice();
            liked = user.Account.LikedUsers.slice();

            matched.push(...liked);

            let matchedIdList = [];
            matched.map((match) => matchedIdList.push(match._id));

            let feed = users.filter((item) => {
              return matchedIdList.indexOf(item._id) === -1;
            });
            feed.sort(() => Math.random() - 0.5);
            res.json(feed);
            //res.json(users);
          });
      });
  } else {
    res.redirect(`${Config.FRONTEND_URL}`);
  }
});

app.get("/account/name/:userName", (req, res) => {
  if (req.isAuthenticated()) {
    User.find({ UserName: req.params.userName })
      .populate("Login")
      .populate("Account")
      .then((user) => res.json(user));
  } else {
    res.redirect(`${Config.FRONTEND_URL}`);
  }
});

app.get("/matches/:id", (req, res) => {
  if (req.isAuthenticated()) {
    User.findOne(
      { _id: req.params.id }.then((user) => {
        Account.findOne({ _id: user.Account })
          .populate("MatchedUsers")
          .populate("Messages")
          .then((account) => {
            res.json(account);
          });
      })
    );
  } else {
    res.redirect(`${Config.FRONTEND_URL}`);
  }
});

app.get("/account/id/:id", (req, res) => {
  if (req.isAuthenticated()) {
    User.find({ _id: req.params.id })
      .populate("Login")
      .populate("Account")
      .then((user) => res.json(user));
  } else {
    res.redirect(`${Config.FRONTEND_URL}`);
  }
});

app.put("/users/:id", (req, res) => {
  if (req.isAuthenticated()) {
    User.findOneAndUpdate({ _id: req.params.id }, req.body).then((user) => {
      res.json(user);
    });
  } else {
    res.redirect(`${Config.FRONTEND_URL}`);
  }
});

app.put("/profile/:id", (req, res) => {
  /*
  we want to edit whatever fields are passed on the user object
  req.body = {
    RealName:String
    Bio: String
    Workplace: String
  }
  */
  if (req.isAuthenticated()) {
    User.find({ _id: req.params.id }).then((user) => {
      if (user !== undefined) {
        Account.findOneAndUpdate({ _id: user.Account }, req.body).then(
          (account) => {
            res.json(account);
          }
        );
      }
    });
  } else {
    res.redirect(`${Config.FRONTEND_URL}`);
  }
});

app.put("/profile/:edit", (req, res) => {
  if (req.isAuthenticated()) {
    User.find({ UserName: req.params.edit }).then((res) => {
      if (res !== undefined) {
        Account.findOneAndUpdate({ _id: res.Account }, req.body).then(
          (account) => {
            res.json(account);
          }
        );
      }
    });
  } else {
    res.redirect(`${Config.FRONTEND_URL}`);
  }
});

app.delete("/users/:id", (req, res) => {
  if (req.isAuthenticated()) {
    User.findOneByDelete({ _id: req.params.id }).then((user) => res.json(user));
  } else {
    res.redirect(`${Config.FRONTEND_URL}`);
  }
});

app.put("/like/:id", (req, res) => {
  if (req.isAuthenticated()) {
    /* 
    Match Logic:
    req should have the id of the current login user, and the id of the profile that they like
    then it should check the like array of the person being liked to see if they like current user
    then if user is present, add them to each others match array and delete from likes
    else add the target to users liked array and return
    */
    User.findOneByDelete({ _id: req.params.id }).then((user) => res.json(user));
  } else {
  }
});

app.get("/message/:id", (req, res) => {
  if (req.isAuthenticated()) {
    Account.findOne({ Messages: req.params.id })
      .populate("Messages")
      .then((messages) => {
        res.json(messages);
      });
  } else {
    res.redirect(`${Config.FRONTEND_URL}`);
  }
});

app.put("/like/:likedUserId", (req, res) => {
  if (req.isAuthenticated()) {
    let currentUserId = req.user._id;
    let currentUserAccountId = req.user.Account;

    let likedUserId = req.params.likedUserId;

    Account.findOne({ _id: currentUserAccountId }).then(
      (currentUserAccount) => {
        let currentUserLikedUsers = currentUserAccount.LikedUsers;

        User.find({ _id: likedUserId }).then((likedUser) => {
          Account.findOne({
            _id: likedUser.Account,
          })
            .then((likedUserAccount) => {
              let likedUserLikedUsers = likedUserAccount.LikedUsers;
              if (likedUserLikedUsers.length > 0) {
                let _index = likedUserLikedUsers.indexOf(currentUserId);
                if (_index !== -1) {
                  // if current user in liked user's like list
                  let likedUserMatchedUsers = likedUserAccount.MatchedUsers;
                  likedUserMatchedUsers.push(currentUserId);
                  likedUserLikedUsers.splice(_index, 1);

                  likedUserAccount.save();

                  let currentUserMatchedUsers = currentUserAccount.MatchedUsers;
                  currentUserMatchedUsers.push(likedUserId);
                  currentUserAccount.save();
                } else {
                  // if current user in liked user's like list
                  currentUserLikedUsers.push(likedUserId);
                  currentUserAccount.save();
                }
              } else {
                // likedUser's like user list is  empty
                currentUserLikedUsers.push(likedUserId);
                currentUserAccount.save();
              }
            })
            .then((res) => {
              res.json(req.user);
            });
        });
      }
    );
  } else {
    res.redirect(`${Config.FRONTEND_URL}`);
  }
});

app.put("/unlike/:unlikedUserId", (req, res) => {
  if (req.isAuthenticated()) {
    let currentUserId = req.user._id;
    let currentUserAccountId = req.user.Account;

    let unlikedUserId = req.params.unlikedUserId;

    Account.findOne({ _id: currentUserAccountId }).then(
      (currentUserAccount) => {
        User.find({ _id: unlikedUserId }).then((unlikedUser) => {
          Account.findOne({
            _id: unlikedUser.Account,
          })
            .then((unlikedUserAccount) => {
              let unlikedUserMatchedUsers = unlikedUserAccount.MatchedUsers;
              let _index = unlikedUserMatchedUsers.indexOf(currentUserId);
              if (_index !== -1) {
                let unlikedUserLikedUsers = unlikedUserAccount.LikedUsers;
                unlikedUserLikedUsers.push(currentUserId);

                unlikedUserMatchedUsers.splice(_index, 1);

                unlikedUserAccount.save();

                let currentUserMatchedUsers = currentUserAccount.MatchedUsers;
                _index = currentUserMatchedUsers.indexOf(unlikedUserId);
                currentUserMatchedUsers.splice(_index, 1);
                currentUserAccount.save();
              } else {
                let currentUserLikedUsers = currentUserAccount.LikedUsers;
                let _index = currentUserLikedUsers.indexOf(unlikedUserId);
                currentUserLikedUsers.splice(_index, 1);
                currentUserAccount.save();
              }
            })
            .then((res) => {
              res.json(req.user);
            });
        });
      }
    );
  } else {
    res.redirect(`${Config.FRONTEND_URL}`);
  }
});
