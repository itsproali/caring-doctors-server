const express = require("express");
const cors = require("cors");
require("dotenv").config();
var jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, Admin } = require("mongodb");
const port = process.env.PORT || 5000;
const app = express();

// middleware
app.use(cors());
app.use(express.json());

const verifyJwt = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.SECRET_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Forbidden Access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster1.jggf1.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const run = async () => {
  try {
    await client.connect();
    const serviceCollection = client.db("DoctorsPortal").collection("services");
    const bookingCollection = client.db("DoctorsPortal").collection("bookings");
    const userCollection = client.db("DoctorsPortal").collection("users");
    const doctorCollection = client.db("DoctorsPortal").collection("doctors");

    // Create User
    app.put("/user/:uid", async (req, res) => {
      let updateInfo = {};
      const user = req.body;
      const uid = req.params.uid;
      const query = { uid };
      const options = { upsert: true };
      const existUser = await userCollection.findOne(query);
      if (existUser) {
        updateInfo = {
          $set: existUser,
        };
      } else if (!user.role) {
        user.role = "user";
        updateInfo = {
          $set: user,
        };
      } else {
        updateInfo = {
          $set: user,
        };
      }
      const result = await userCollection.updateOne(query, updateInfo, options);
      const token = jwt.sign({ uid }, process.env.SECRET_TOKEN, {
        expiresIn: "12h",
      });
      res.send({ result, token });
    });

    // Get All Services
    app.get("/services", async (req, res) => {
      const query = {};
      const cursor = serviceCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // Get available Services
    app.get("/available", async (req, res) => {
      const date = req.query.date || "May 16, 2022";
      const services = await serviceCollection.find().toArray();
      const query = { date };
      const bookings = await bookingCollection.find(query).toArray();
      const booked = services.forEach((service) => {
        const serviceBookings = bookings.filter(
          (book) => book.treatmentName === service.title
        );
        const bookedSlots = serviceBookings.map((book) => book.slot);
        service.available = service.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
      });
      res.send(services);
    });

    // Create a booking
    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const query = {
        treatmentId: booking.treatmentId,
        date: booking.date,
        patientId: booking.patientId,
      };
      const exist = await bookingCollection.findOne(query);
      if (exist) {
        return res.send({ success: false, booking: exist });
      } else {
        const result = await bookingCollection.insertOne(booking);
        return res.send({ success: true, booking });
      }
    });

    // My Appointment
    app.get("/myappointment", verifyJwt, async (req, res) => {
      const decodeId = req.decoded.uid;
      const patientId = req.query.patientId;
      if (decodeId === patientId) {
        const query = { patientId };
        const result = await bookingCollection.find(query).toArray();
        return res.send(result);
      } else {
        return res.status(403).send({ message: "Forbidden Access" });
      }
    });

    // Get All User
    app.get("/users", async (req, res) => {
      const query = {};
      const cursor = userCollection.find(query);
      const users = await cursor.toArray();
      res.send(users);
    });

    // Handle Admin
    app.put("/user/role/:uid", verifyJwt, async (req, res) => {
      const uid = req.params.uid;
      const requesterUid = req.body.requesterUid;
      const requesterAccount = await userCollection.findOne({
        uid: requesterUid,
      });
      if (requesterAccount.role === "admin") {
        const query = { uid };
        const role = req.body.role;
        const updateInfo = {
          $set: { role },
        };
        const result = await userCollection.updateOne(query, updateInfo);
        res.send(result);
      } else {
        res.status(401).send({ message: "Unauthorized Access" });
      }
    });

    // Check Admin
    app.get("/admin/:uid", async (req, res) => {
      const uid = req.params.uid;
      const user = await userCollection.findOne({ uid });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });

    // Get Categories
    app.get("/categories", async (req, res) => {
      const query = {};
      const categories = await serviceCollection
        .find(query)
        .project({ title: 1 })
        .toArray();
      res.send(categories);
    });

    // Add doctor
    app.post("/add-doctor", verifyJwt, async (req, res) => {
      const doctor = req.body;
      const result = await doctorCollection.insertOne(doctor);
      res.send(result);
    });
  } finally {
    //   client.close()
  }
};

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Doctors Server is Running");
});

app.listen(port, () => {
  console.log("Server Running on: ", port);
});
