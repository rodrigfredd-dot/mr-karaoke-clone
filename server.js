const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

// 1. Connect to Database
const databaseURI = 'mongodb://127.0.0.1:27017/karaokeDB';
mongoose.connect(databaseURI)
  .then(() => console.log("-> Database connection active!"))
  .catch(() => console.log("-> Operating in temporary sandbox memory mode..."));

// 2. Define Data Schema
const LeadSchema = new mongoose.Schema({
  venueName: String,
  dateSubmitted: { type: Date, default: Date.now }
});

// New Data Model for the Venue Schedule
const ScheduleSchema = new mongoose.Schema({
  day: { type: String, required: true },
  venue: { type: String, required: true },
  time: { type: String, required: true },
  address: String
});
const Schedule = mongoose.model('Schedule', ScheduleSchema);

// New Data Model for the Searchable Song List
const SongSchema = new mongoose.Schema({
  title: { type: String, required: true },
  artist: { type: String, required: true },
  genre: String
});
// Speed optimization: index titles and artists so searches complete in milliseconds
SongSchema.index({ title: 'text', artist: 'text' }); 
const Song = mongoose.model('Song', SongSchema);


const Lead = mongoose.model('Lead', LeadSchema);

// Backup array variable to prevent crashes if MongoDB drops offline
let backupMemoryDB = [];

// 3. POST Route: Save entries
// POST Route: Save a newly written show into the database
app.post('/api/schedule', async (req, res) => {
  try {
    const { day, venue } = req.body;
    
    // Create the document based on your Schedule database model
    const newShow = new Schedule({ 
      day: day, 
      venue: venue, 
      time: "9:00 PM", 
      address: "Houston, TX" 
    });
    
    await newShow.save();
    res.status(201).json(newShow);
  } catch (err) {
    res.status(500).json({ error: "Failed to publish gig listing." });
  }
});

// 4. GET Route: Fetch entries for your Admin Dashboard
app.get('/api/leads', async (req, res) => {
  try {
    // If database connection is active, query MongoDB
    if (mongoose.connection.readyState === 1) {
      const allLeads = await Lead.find().sort({ dateSubmitted: -1 });
      return res.json(allLeads);
    } else {
      // If MongoDB is offline, gracefully return backup memory list
      return res.json(backupMemoryDB.reverse());
    }
  } catch (error) {
    console.error("Dashboard route error:", error);
    res.status(500).json({ error: "Failed to read database records." });
  }
});

// 1. GET Route: Fetch the rotating weekly itinerary
app.get('/api/schedule', async (req, res) => {
  try {
    const weeklyShows = await Schedule.find();
    res.json(weeklyShows);
  } catch (err) {
    res.status(500).json({ error: "Could not fetch show calendar." });
  }
});

// 2. GET Route: Live filter songs by search queries
app.get('/api/songs', async (req, res) => {
  try {
    const searchWord = req.query.q;
    if (!searchWord) {
      // If search bar is blank, return a default sample layout list
      const defaultSongs = await Song.find().limit(10);
      return res.json(defaultSongs);
    }
    
    // Look for matching letters inside your database artist/title metrics
    const matchingSongs = await Song.find({
      $or: [
        { title: { $regex: searchWord, $options: 'i' } },
        { artist: { $regex: searchWord, $options: 'i' } }
      ]
    }).limit(50); // Limit outputs to 50 results for rapid page loads
    
    res.json(matchingSongs);
  } catch (err) {
    res.status(500).json({ error: "Song search engine malfunction." });
  }
});

// DELETE Route: Purge a specific show by its unique database ID
app.delete('/api/schedule/:id', async (req, res) => {
  try {
    const showId = req.params.id;
    
    // Delete the target document from MongoDB using its ID
    await Schedule.findByIdAndDelete(showId);
    
    res.json({ success: true, message: "Gig deleted successfully." });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove entry from storage." });
  }
});


app.listen(5000, () => {
  console.log('Your upgraded Database Server is running live at http://localhost:5000');
});

async function seedDatabase() {
  const scheduleCount = await Schedule.countDocuments();
  if (scheduleCount === 0) {
    await Schedule.create([
      { day: "Thursday", venue: "Sundown Saloon", time: "8:00 PM - 12:00 AM", address: "4818 Dacoma St" },
      { day: "Saturday", venue: "PUB 529", time: "9:00 PM - 2:00 AM", address: "14129 Memorial Dr" }
    ]);
  }
  const songCount = await Song.countDocuments();
  if (songCount === 0) {
    await Song.create([
      { title: "Party In The USA", artist: "Miley Cyrus", genre: "Pop" },
      { title: "Friends In Low Places", artist: "Garth Brooks", genre: "Country" },
      { title: "Bohemian Rhapsody", artist: "Queen", genre: "Rock" }
    ]);
  }
}
seedDatabase();
