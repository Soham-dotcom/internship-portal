# SPIT Internship Management & Analytics Portal

A centralized internship portal for SPIT coordinators and mentors to manage internship details, track progress, analyze company-wise hiring, generate groups, and pick students randomly.

## Features

- 📊 **Dashboard Analytics**: View summary cards and charts for internships, companies, and students
- 📝 **Internship Management**: List, filter, and manage all internship records
- 📤 **Excel Import/Export**: Upload Excel files to import data and export filtered results
- 👥 **Group Generator**: Create student groups with customizable filters
- 🎲 **Random Student Picker**: Randomly select students based on filters
- 📈 **Company Analytics**: Analyze hiring patterns, branch distribution, and stipend data
- 🔍 **Advanced Filtering**: Filter by branch, company, status, mentor, year, and more

## Tech Stack

### Backend
- Node.js
- Express
- MongoDB
- Mongoose
- XLSX (Excel processing)
- Multer (File uploads)

### Frontend
- React.js
- TailwindCSS
- Recharts (Data visualization)
- Axios (API calls)

## Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (running locally or connection string)

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd Internship_portal
```

2. Install backend dependencies:
```bash
npm install
```

3. Install frontend dependencies:
```bash
cd frontend
npm install
cd ..
```

4. Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

Edit `.env` and add your MongoDB connection string:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/spit-internships
NODE_ENV=development
```

5. Start MongoDB (if running locally):
```bash
mongod
```

6. Run the application:
```bash
# Run both backend and frontend concurrently
npm run dev

# Or run separately:
# Terminal 1 - Backend
npm run server

# Terminal 2 - Frontend
npm run client
```

7. Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## API Endpoints

### Internships
- `GET /api/internships` - Get all internships with filters
- `GET /api/internships/:id` - Get single internship
- `POST /api/internships` - Create new internship
- `PUT /api/internships/:id` - Update internship
- `DELETE /api/internships/:id` - Delete internship
- `GET /api/internships/stats/summary` - Get summary statistics

### Upload
- `POST /api/upload/excel` - Parse Excel file
- `POST /api/upload/import` - Import parsed data to MongoDB
- `GET /api/upload/template` - Download Excel template

### Analytics
- `GET /api/analytics/companies` - Company-wise statistics
- `GET /api/analytics/branches` - Branch distribution
- `GET /api/analytics/status` - Status distribution
- `GET /api/analytics/companies/branches` - Branch distribution per company
- `GET /api/analytics/stipends` - Stipend comparison
- `GET /api/analytics/types` - Internship type distribution
- `GET /api/analytics/summary` - Comprehensive summary

### Groups
- `POST /api/groups/generate` - Generate student groups
- `POST /api/groups/export` - Export groups to Excel
- `POST /api/groups/random-pick` - Pick random students
- `POST /api/groups/export-random` - Export random students to Excel

## Data Model

The system uses the following data structure for internships:

```javascript
{
  student: {
    name: String,
    email: String,
    phone: String,
    rollNo: String,
    branch: String (comps|extc|cse|mca|aiml),
    year: String,
    avatar: String (optional)
  },
  company: {
    name: String,
    location: String,
    website: String
  },
  internship: {
    title: String,
    type: String,
    duration: String,
    startDate: Date,
    endDate: Date,
    stipend: String,
    status: String (pending|approved|in-progress|completed|cancelled)
  },
  mentor: {
    name: String,
    email: String,
    designation: String
  },
  evaluation: {
    rating: Number (0-5),
    feedback: String,
    skills: [String]
  },
  submittedAt: Date
}
```

## Excel Template

Download the Excel template from the Upload page to see the required format for importing data. The template includes all necessary columns with sample data.

## Contributing

This is an internal project for SPIT. For any issues or suggestions, please contact the development team.

## License

ISC





