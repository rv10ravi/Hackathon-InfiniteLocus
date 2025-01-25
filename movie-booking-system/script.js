console.log("Script loaded successfully");

class MovieBookingSystem {
  constructor() {
    this.selectedSeats = new Set();
    this.currentShowTimeId = null;
    this.currentMovieId = null;
    this.apiUrl = "http://localhost:5000/api";

    this.initializeElements();
    this.attachEventListeners();
    this.loadMovies();
    this.cancelBookingModal = new bootstrap.Modal(
      document.getElementById("cancelBookingModal")
    );
    this.attachCancelBookingListeners();
  }

  initializeElements() {
    this.movieSelect = document.getElementById("movieSelect");
    this.showTimeSelect = document.getElementById("showTimeSelect");
    this.loadSeatsBtn = document.getElementById("loadSeatsBtn");
    this.bookingSection = document.getElementById("bookingSection");
    this.seatContainer = document.getElementById("seatContainer");
    this.bookButton = document.getElementById("bookButton");
    this.showBookingsBtn = document.getElementById("showBookingsBtn");

    // Add seat container click listener
    this.seatContainer.addEventListener("click", (event) => {
      this.handleSeatClick(event);
    });

    // Initialize Bootstrap modals
    this.bookingModal = new bootstrap.Modal(
      document.getElementById("bookingModal")
    );
    this.showBookingsModal = new bootstrap.Modal(
      document.getElementById("showBookingsModal")
    );
  }

  attachEventListeners() {
    this.movieSelect.addEventListener("change", () => this.handleMovieChange());
    this.showTimeSelect.addEventListener("change", () =>
      this.handleShowTimeChange()
    );
    this.loadSeatsBtn.addEventListener("click", () => this.loadSeats());
    this.bookButton.addEventListener("click", () => this.showBookingModal());
    this.showBookingsBtn.addEventListener("click", () => this.showBookings());

    document
      .getElementById("confirmBookingBtn")
      .addEventListener("click", () => this.confirmBooking());
  }

  async fetchData(endpoint, options = {}) {
    try {
      console.log(`Fetching from ${endpoint}...`);
      const response = await fetch(`${this.apiUrl}${endpoint}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      const data = await response.json();
      console.log(`Data received from ${endpoint}:`, data);
      return data;
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      this.showNotification(`Error: ${error.message}`, "danger");
      throw error;
    }
  }

  async loadMovies() {
    try {
      const movies = await this.fetchData("/movies");
      console.log("Movies loaded:", movies);

      if (movies.length === 0) {
        this.showNotification("No movies available", "warning");
        return;
      }

      this.movieSelect.innerHTML = `
                <option value="">Select Movie</option>
                ${movies
                  .map(
                    (movie) => `
                    <option value="${movie.id}">${movie.title}</option>
                `
                  )
                  .join("")}
            `;
    } catch (error) {
      this.movieSelect.innerHTML =
        '<option value="">Error loading movies</option>';
    }
  }

  async handleMovieChange() {
    try {
      this.currentMovieId = this.movieSelect.value;
      this.showTimeSelect.disabled = !this.currentMovieId;
      this.loadSeatsBtn.disabled = true;
      this.bookingSection.style.display = "none";

      if (this.currentMovieId) {
        console.log("Fetching showtimes for movie:", this.currentMovieId);
        const showTimes = await this.fetchData(
          `/showtimes/${this.currentMovieId}`
        );
        console.log("Received showtimes:", showTimes);

        if (!Array.isArray(showTimes) || showTimes.length === 0) {
          this.showTimeSelect.innerHTML =
            '<option value="">No show times available</option>';
          this.showNotification(
            "No show times available for this movie",
            "warning"
          );
          return;
        }

        this.showTimeSelect.innerHTML = `
                <option value="">Select Show Time</option>
                ${showTimes
                  .map(
                    (show) => `
                    <option value="${show.id}">
                        ${new Date(show.show_time).toLocaleString()}
                    </option>
                `
                  )
                  .join("")}
            `;
        this.showTimeSelect.disabled = false;
      } else {
        this.showTimeSelect.innerHTML =
          '<option value="">Select Show Time</option>';
        this.showTimeSelect.disabled = true;
      }
    } catch (error) {
      console.error("Error in handleMovieChange:", error);
      this.showTimeSelect.innerHTML =
        '<option value="">Error loading show times</option>';
      this.showNotification("Error loading show times", "danger");
    }
  }

  handleShowTimeChange() {
    this.currentShowTimeId = this.showTimeSelect.value;
    this.loadSeatsBtn.disabled = !this.currentShowTimeId;
  }

  async loadSeats() {
    if (!this.currentShowTimeId) return;

    try {
      const seats = await this.fetchData(`/seats/${this.currentShowTimeId}`);
      this.bookingSection.style.display = "block";
      this.renderSeats(seats);
    } catch (error) {
      this.bookingSection.style.display = "none";
    }
  }

  renderSeats(seats) {
    this.seatContainer.innerHTML = seats
      .map(
        (seat) => `
            <div class="seat ${seat.booking_id ? "booked" : "available"}"
                 data-seat-id="${seat.id}"
                 data-booking-id="${seat.booking_id || ""}"
                 title="Seat ${seat.id} ${
          seat.customer_name ? `(Booked by: ${seat.customer_name})` : ""
        }">
                ${seat.id}
            </div>
        `
      )
      .join("");

    // Clear previous selections
    this.selectedSeats.clear();
    this.bookButton.disabled = true;
  }

  handleSeatClick(event) {
    if (!event.target.classList.contains("seat")) return;

    const seatElement = event.target;
    const seatId = parseInt(seatElement.dataset.seatId);
    const bookingId = seatElement.dataset.bookingId;

    if (bookingId) {
      this.showNotification("This seat is already booked", "warning");
      return;
    }

    seatElement.classList.toggle("selected");
    if (this.selectedSeats.has(seatId)) {
      this.selectedSeats.delete(seatId);
    } else {
      this.selectedSeats.add(seatId);
    }

    this.bookButton.disabled = this.selectedSeats.size === 0;
  }

  showBookingModal() {
    document.getElementById("selectedSeatsDisplay").textContent = Array.from(
      this.selectedSeats
    ).join(", ");
    this.bookingModal.show();
  }

  async confirmBooking() {
    const form = document.getElementById("bookingForm");
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const formData = new FormData(form);
    const bookingData = {
      customerName: formData.get("customerName"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      movieId: this.currentMovieId,
      showTimeId: this.currentShowTimeId,
      seatIds: Array.from(this.selectedSeats),
    };

    try {
      await this.fetchData("/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingData),
      });

      this.showNotification("Booking successful!", "success");
      this.bookingModal.hide();
      form.reset();
      this.selectedSeats.clear();
      this.loadSeats();
    } catch (error) {
      this.showNotification("Booking failed", "danger");
    }
  }

  async showBookings() {
    if (!this.currentShowTimeId) return;

    try {
      const bookings = await this.fetchData(
        `/bookings/${this.currentShowTimeId}`
      );

      document.getElementById("bookingsTableBody").innerHTML = bookings
        .map(
          (booking) => `
                <tr>
                    <td>${booking.seat_number}</td>
                    <td>${booking.customer_name}</td>
                    <td>${booking.email}</td>
                    <td>${booking.phone}</td>
                    <td>
                        <button class="btn btn-sm btn-danger" 
                                onclick="movieBookingSystem.cancelBooking(${booking.id})">
                            Cancel
                        </button>
                    </td>
                </tr>
            `
        )
        .join("");

      this.showBookingsModal.show();
    } catch (error) {
      this.showNotification("Error loading bookings", "danger");
    }
  }

  async cancelBooking(bookingId) {
    if (!confirm("Are you sure you want to cancel this booking?")) return;

    try {
      await this.fetchData(`/cancel/${bookingId}`, { method: "POST" });
      this.showNotification("Booking cancelled successfully", "success");
      this.showBookingsModal.hide();
      this.loadSeats();
    } catch (error) {
      this.showNotification("Error cancelling booking", "danger");
    }
  }
  attachCancelBookingListeners() {
    document
      .getElementById("cancelBookingBtn")
      .addEventListener("click", () => {
        this.cancelBookingModal.show();
      });

    document
      .getElementById("confirmCancelBtn")
      .addEventListener("click", () => {
        this.handleCancelBooking();
      });
  }

  async handleCancelBooking() {
    const form = document.getElementById("cancelBookingForm");
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const formData = new FormData(form);
    const email = formData.get("email");
    const bookingId = formData.get("bookingId");

    try {
      const response = await fetch(`${this.apiUrl}/cancel-booking`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          bookingId: bookingId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to cancel booking");
      }

      this.showNotification("Booking cancelled successfully", "success");
      this.cancelBookingModal.hide();
      form.reset();

      // Refresh seats if a show time is selected
      if (this.currentShowTimeId) {
        this.loadSeats();
      }
    } catch (error) {
      this.showNotification(
        "Failed to cancel booking: " + error.message,
        "danger"
      );
    }
  }

  showNotification(message, type) {
    const toastContainer = document.getElementById("notification");
    const toast = document.createElement("div");
    toast.className = `toast show bg-${type} text-white`;
    toast.innerHTML = `
            <div class="toast-body">
                ${message}
            </div>
        `;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
}

// Initialize the booking system
let movieBookingSystem;
document.addEventListener("DOMContentLoaded", () => {
  movieBookingSystem = new MovieBookingSystem();
  window.movieBookingSystem = movieBookingSystem; // For global access
});
