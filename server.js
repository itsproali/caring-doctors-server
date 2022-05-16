const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 5000;
const app = express();

// middleware
app.use(cors());
app.use(express.json());

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
