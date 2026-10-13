const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data.json");
const MAX_SEATS = 30;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function readData(){
  try{
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return raw.trim() ? JSON.parse(raw) : [];
  }catch (err){
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

function writeData(records){
  fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2), "utf8");
}

function isBlank(value){
  return typeof value !== "string" || value.trim() === "";
}

app.get("/api/reservations", (req, res) => {
  res.status(200).json(readData());
});

app.get("/api/reservations/:id", (req, res) => {
  const id = Number(req.params.id);
  const reservation = readData().find((r) => r.id === id);

  if (!reservation) {
    return res.status(404).json({ error: `Reservation with ID ${req.params.id} not found.` });
  }
  res.status(200).json(reservation);
});

app.post("/api/reservations", (req, res) => {
  const { student_name, lab, date, number_of_seats, purpose } = req.body || {};

  const missing = [];
  if (isBlank(student_name)) missing.push("student_name");
  if (isBlank(lab)) missing.push("lab");
  if (isBlank(date)) missing.push("date");
  if (isBlank(purpose)) missing.push("purpose");
  if (number_of_seats === undefined || number_of_seats === null || number_of_seats === "") {
    missing.push("number_of_seats");
  }
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing or empty field(s): ${missing.join(", ")}.` });
  }

  const seats = Number(number_of_seats);
  if (!Number.isInteger(seats)) {
    return res.status(400).json({ error: "number_of_seats must be a whole number." });
  }
  if (seats <= 0) {
    return res.status(400).json({ error: "number_of_seats must be greater than 0." });
  }
  if (seats > MAX_SEATS) {
    return res.status(400).json({ error: `number_of_seats cannot be greater than ${MAX_SEATS}.` });
  }

  // date validation (a real calendar date in YYYY-MM-DD format)
  const dateMatch = typeof date === "string" && /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const parsedDate = dateMatch && new Date(Date.UTC(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3])
  ));
  if (!parsedDate || parsedDate.toISOString().slice(0, 10) !== date) {
    return res.status(400).json({ error: "date must be a valid date in YYYY-MM-DD format." });
  }

  const records = readData();
  const nextId = records.length > 0 ? Math.max(...records.map((r) => r.id)) + 1 : 1;

  const newReservation = {
    id: nextId,
    student_name: student_name.trim(),
    lab: lab.trim(),
    date,
    number_of_seats: seats,
    purpose: purpose.trim(),
  };

  records.push(newReservation);
  writeData(records);

  res.status(201).json(newReservation);
});

app.delete("/api/reservations/:id", (req, res) => {
  const id = Number(req.params.id);
  const records = readData();
  const index = records.findIndex((r) => r.id === id);

  if (index === -1) {
    return res.status(404).json({ error: `Reservation with ID ${req.params.id} not found.` });
  }

  const [deleted] = records.splice(index, 1);
  writeData(records);

  res.status(200).json({ message: "Reservation deleted.", deleted });
});

app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON in request body." });
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`Lab Reservation API running at http://localhost:${PORT}`);
});