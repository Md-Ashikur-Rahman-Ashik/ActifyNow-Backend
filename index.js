const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: [/*"http://localhost:5173",*/ "https://actifynow-bd532.web.app"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  })
);
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tx9lkv1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
};

const verifyToken = (req, res, next) => {
  const token = req.cookies.Token;
  // console.log("Token in the middleware", token);

  // No token provided
  if (!token) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized Access" });
    }
    req.user = decoded;
    next();
  });
  // next();
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const volunteerCollection = client.db("actifyNow").collection("volunteer");

    const requestCollection = client.db("actifyNow").collection("request");

    app.get("/needVolunteer", async (req, res) => {
      const cursor = volunteerCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/volunteer/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const volunteer = await volunteerCollection.findOne(query);
      res.send(volunteer);
    });

    app.get("/volunteers", verifyToken, async (req, res) => {
      // console.log(req.query.organizerEmail);
      // console.log(req.body);
      if (req.user.email !== req.query.organizerEmail) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      let query = {};
      if (req.query?.organizerEmail) {
        query = { organizerEmail: req.query.organizerEmail };
      }

      const volunteer = await volunteerCollection.find(query).toArray();
      res.send(volunteer);
    });

    // Be a volunteer request data
    app.get("/newVolunteer", verifyToken, async (req, res) => {
      if (req.user.email !== req.query.volunteerEmail) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      let query = {};
      if (req.query?.volunteerEmail) {
        query = { volunteerEmail: req.query.volunteerEmail };
      }
      // const cursor = requestCollection.find();
      const result = await requestCollection.find(query).toArray();
      res.send(result);
    });

    // Generate JWT token
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.cookie("Token", token, cookieOptions).send({ success: true });
    });

    // API for logout user
    app.post("/logout", async (req, res) => {
      const user = req.body;
      res
        .clearCookie("Token", { ...cookieOptions, maxAge: 0 })
        .send({ success: true });
    });

    app.post("/volunteers", verifyToken, async (req, res) => {
      const volunteer = req.body;
      const result = await volunteerCollection.insertOne(volunteer);
      res.send(result);
    });

    // Post request to new collection
    app.post("/newVolunteer", async (req, res) => {
      const volunteer = req.body;
      const result = await requestCollection.insertOne(volunteer);
      res.send(result);
    });

    // Decrease request to old collection
    app.put("/newVolunteer/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const result = await volunteerCollection.updateOne(
        query,
        {
          $inc: {
            numberOfVolunteers: -1,
          },
        },
        options
      );
      res.send(result);
    });

    app.put("/volunteer/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedVolunteer = req.body;
      const volunteer = {
        $set: {
          thumbnail: updatedVolunteer.thumbnail,
          postTitle: updatedVolunteer.postTitle,
          description: updatedVolunteer.description,
          categoryBox: updatedVolunteer.categoryBox,
          location: updatedVolunteer.location,
          numberOfVolunteers: updatedVolunteer.numberOfVolunteers,
          date: updatedVolunteer.date,
        },
      };
      const result = await volunteerCollection.updateOne(
        query,
        volunteer,
        options
      );
      res.send(result);
    });

    app.delete("/volunteer/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await volunteerCollection.deleteOne(query);
      res.send(result);
    });

    // Delete data from new collection
    app.delete("/newVolunteer/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await requestCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
