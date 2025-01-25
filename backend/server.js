const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Enhanced CORS configuration
app.use(
  cors({
    origin: "*", // In production, replace with your frontend URL
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use(express.json());

// Database configuration
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "movie_booking",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Test database connection
async function testDBConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("Database connected successfully!");
    connection.release();
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
}

testDBConnection();

// API Routes
// Get all movies
app.get("/api/movies", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM movies ORDER BY title");
    console.log("Movies fetched:", rows);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching movies:", error);
    res.status(500).json({ error: "Failed to fetch movies" });
  }
});

// Get showtimes for a movie
app.get("/api/showtimes/:movieId", async (req, res) => {
  try {
    console.log("Fetching showtimes for movie ID:", req.params.movieId);
    const [rows] = await pool.query(
      "SELECT * FROM show_times WHERE movie_id = ? ORDER BY show_time",
      [req.params.movieId]
    );
    console.log("Showtimes fetched:", rows);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching showtimes:", error);
    res.status(500).json({ error: "Failed to fetch showtimes" });
  }
});

// Get seats for a showtime
app.get("/api/seats/:showTimeId", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
            SELECT s.*, 
                   b.id as booking_id,
                   b.customer_name
            FROM seats s
            LEFT JOIN bookings b ON s.id = b.seat_id 
            AND b.show_time_id = ?
            ORDER BY s.id
        `,
      [req.params.showTimeId]
    );

    console.log("Seats fetched for showtime:", req.params.showTimeId);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching seats:", error);
    res.status(500).json({ error: "Failed to fetch seats" });
  }
});

// Book seats
app.post("/api/book", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { customerName, email, phone, movieId, showTimeId, seatIds } =
      req.body;
    console.log("Booking request received:", {
      customerName,
      movieId,
      showTimeId,
      seatIds,
    });

    // Check if seats are already booked
    const [existingBookings] = await connection.query(
      "SELECT seat_id FROM bookings WHERE show_time_id = ? AND seat_id IN (?)",
      [showTimeId, seatIds]
    );

    if (existingBookings.length > 0) {
      throw new Error("Some seats are already booked");
    }

    // Create bookings
    for (const seatId of seatIds) {
      await connection.query(
        `INSERT INTO bookings (customer_name, email, phone, movie_id, show_time_id, seat_id)
                 VALUES (?, ?, ?, ?, ?, ?)`,
        [customerName, email, phone, movieId, showTimeId, seatId]
      );
    }

    await connection.commit();
    console.log("Booking successful for seats:", seatIds);
    res.json({ message: "Booking successful" });
  } catch (error) {
    await connection.rollback();
    console.error("Error in booking:", error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Cancel booking
app.post("/api/cancel/:bookingId", async (req, res) => {
  try {
    await pool.query("DELETE FROM bookings WHERE id = ?", [
      req.params.bookingId,
    ]);
    console.log("Booking cancelled:", req.params.bookingId);
    res.json({ message: "Booking cancelled successfully" });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    res.status(500).json({ error: "Failed to cancel booking" });
  }
});

// Get all bookings for a showtime
app.get("/api/bookings/:showTimeId", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
            SELECT b.*, s.id as seat_number
            FROM bookings b
            JOIN seats s ON b.seat_id = s.id
            WHERE b.show_time_id = ?
            ORDER BY s.id
        `,
      [req.params.showTimeId]
    );

    console.log("Bookings fetched for showtime:", req.params.showTimeId);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API endpoints available at http://localhost:${PORT}/api/`);
});

// Add this new endpoint for cancelling bookings
app.post("/api/cancel-booking", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { email, bookingId } = req.body;

    // First verify the booking exists and belongs to the email
    const [booking] = await connection.query(
      "SELECT * FROM bookings WHERE id = ? AND email = ?",
      [bookingId, email]
    );

    if (!booking.length) {
      throw new Error("Booking not found or email does not match");
    }

    // Delete the booking
    await connection.query("DELETE FROM bookings WHERE id = ?", [bookingId]);

    res.json({ message: "Booking cancelled successfully" });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    res.status(400).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Modify the existing bookings endpoint to include booking ID
app.get("/api/bookings/:showTimeId", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
            SELECT b.id as booking_id, b.customer_name, b.email, b.phone, 
                   s.id as seat_number
            FROM bookings b
            JOIN seats s ON b.seat_id = s.id
            WHERE b.show_time_id = ?
            ORDER BY s.id
        `,
      [req.params.showTimeId]
    );

    console.log("Bookings fetched for showtime:", req.params.showTimeId);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});
