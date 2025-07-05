const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');
const uri ="mongodb+srv://MyTaxi:Abibobi8@cluster0.mhxj20w.mongodb.net/MyTaxi?retryWrites=true&w=majority";
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let db;

// ================= START SERVER ================= //
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});


// ================= Connect to MongoDB ================= //
async function connectDB() {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    console.log('MongoDB Connected');
    db = client.db('MyTaxi');
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
}
connectDB();

// ================= JWT Middleware to authenticate token ================= //
const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: "Invalid token" });
    }
};


// ================= USER ================= //

// Register User
app.post('/users/register', async (req, res) => {
  try {
    const result = await db.collection('users').insertOne(req.body);
    res.status(201).json({ message: 'User registered', id: result.insertedId });
  } catch (err) {
    res.status(400).json({ error: 'User registration failed' });
  }
});

// Login User (returns JWT token)
app.post('/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await db.collection('users').findOne({ email, password });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({ message: 'Login successful', token });
  } catch (err) {
    res.status(500).json({ error: 'Login error' });
  }
});

// View User Profile (Protected)
app.get('/users/:id', authenticate, async (req, res) => {
  try {
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.params.id) });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.status(200).json(user);
  } catch (err) {
    res.status(400).json({ error: 'Invalid user ID' });
  }
});

// ================= RIDE ================= //

// Book a Ride 
app.post('/rides', authenticate, async (req, res) => {
  try {
    const rideData = {
      ...req.body,
      passengerId: req.user.userId  
    };

    const result = await db.collection('rides').insertOne(rideData);
    res.status(201).json({ message: 'Ride booked', id: result.insertedId });
  } catch (err) {
    res.status(400).json({ error: 'Ride booking failed' });
  }
});

// Get Ride 
app.get('/rides/:id', authenticate, async (req, res) => {
  try {
    const ride = await db.collection('rides').findOne({ _id: new ObjectId(req.params.id) });
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    res.status(200).json(ride);
  } catch (err) {
    res.status(400).json({ error: 'Invalid ride ID' });
  }
});

// Update Ride Status 
app.patch('/rides/:id', authenticate, async (req, res) => {
  try {
    const result = await db.collection('rides').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status: req.body.status, driverId: req.user.userId } }
    );
    if (result.modifiedCount === 0) return res.status(404).json({ error: 'Ride not found' });
    res.status(200).json({ message: 'Ride status updated', updated: result.modifiedCount });
  } catch (err) {
    res.status(400).json({ error: 'Ride update failed' });
  }
});

// View Passenger Ride History
app.get('/rides/history/:passengerId', authenticate, async (req, res) => {
  try {
    const rides = await db.collection('rides').find({ passengerId: req.params.passengerId }).toArray();
    res.status(200).json(rides);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ride history' });
  }
});

//DELETE RIDE 
app.delete('/rides/:id', authenticate, async (req, res) => {
  try {
    const result = await db.collection('rides').deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Ride not found' });
    }
    res.status(200).json({ message: 'Ride deleted successfully', deleted: result.deletedCount });
  } catch (err) {
    res.status(400).json({ error: 'Ride deletion failed' });
  }
});

// ================= VEHICLE ================= //

// Register Vehicle 
app.post('/vehicles/register', authenticate, async (req, res) => {
  try {
    const vehicleData = {
      ...req.body,
      driverId: req.user.userId
    };

    const result = await db.collection('vehicles').insertOne(vehicleData);
    res.status(201).json({ message: 'Vehicle registered', id: result.insertedId });
  } catch (err) {
    res.status(400).json({ error: 'Vehicle registration failed' });
  }
});

// Get Vehicles by Driver ID 
app.get('/vehicles/driver/:driverId', authenticate, async (req, res) => {
  try {
    const vehicles = await db.collection('vehicles').find({ driverId: req.params.driverId }).toArray();
    res.status(200).json(vehicles);
  } catch (err) {
    res.status(400).json({ error: 'Failed to fetch vehicles' });
  }
});

// ================= ADMIN ================= //

// Admin Login (returns JWT Token)
app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const admin = await db.collection('users').findOne({ username, password, role: "admin" });
    if (!admin) return res.status(401).json({ error: 'Invalid admin credentials' });

    const token = jwt.sign(
      { adminId: admin._id, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({ message: 'Admin login successful', token });
  } catch (err) {
    res.status(500).json({ error: 'Admin login failed' });
  }
});


// Admin Analytics (Protected - Only Admin)
app.get('/admin/analytics', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied. Admins only.' });

  try {
    const usersCount = await db.collection('users').countDocuments();
    const ridesCount = await db.collection('rides').countDocuments();
    const driversCount = await db.collection('users').countDocuments({ role: 'driver' });
    res.status(200).json({ users: usersCount, rides: ridesCount, drivers: driversCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});


