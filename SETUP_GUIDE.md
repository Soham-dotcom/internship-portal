# SPIT Internship Portal - Complete Setup Guide

## 🚀 Quick Start

This guide will help you set up and run the SPIT Internship Management & Analytics Portal.

## Prerequisites

Make sure you have the following installed:

1. **Node.js** (v14 or higher) - [Download here](https://nodejs.org/)
2. **MongoDB** (v4.4 or higher) - [Download here](https://www.mongodb.com/try/download/community)
   - OR use MongoDB Atlas (cloud) - [Sign up here](https://www.mongodb.com/cloud/atlas)
3. **Git** (optional) - [Download here](https://git-scm.com/)

## Installation Steps

### Step 1: Install Backend Dependencies

Open PowerShell or Command Prompt in the project root directory:

```powershell
npm install
```

### Step 2: Install Frontend Dependencies

```powershell
cd frontend
npm install
cd ..
```

### Step 3: Configure Environment Variables

The `.env` file has been created in the root directory with default settings:

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/spit-internships
NODE_ENV=development
```

**If using MongoDB Atlas (cloud database):**
- Replace `MONGODB_URI` with your Atlas connection string
- Example: `mongodb+srv://username:password@cluster.mongodb.net/spit-internships`

### Step 4: Start MongoDB (Local Installation Only)

If you're using MongoDB locally, start the MongoDB service:

**Windows:**
- MongoDB should start automatically as a service
- Or run: `mongod` in a separate terminal

**Mac:**
```bash
brew services start mongodb-community
```

**Linux:**
```bash
sudo systemctl start mongod
```

### Step 5: Run the Application

You have two options:

#### Option A: Run Both Backend and Frontend Together (Recommended)

```powershell
npm run dev
```

This will start:
- Backend server on http://localhost:5000
- Frontend app on http://localhost:3000

#### Option B: Run Separately

**Terminal 1 - Backend:**
```powershell
npm run server
```

**Terminal 2 - Frontend:**
```powershell
cd frontend
npm start
```

### Step 6: Access the Application

Open your browser and navigate to:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000/api

## 🎯 Using the Portal

### 1. Upload Data

1. Go to **Upload Excel** page
2. Download the template Excel file
3. Fill in your internship data
4. Upload and import to database

### 2. View Dashboard

- See summary statistics
- View charts and analytics
- Track internship progress

### 3. Manage Internships

- Filter by branch, company, status, etc.
- Export filtered data to Excel
- View detailed internship information

### 4. Generate Groups

- Set filters (branch, status, etc.)
- Configure group size or number of groups
- Export groups to Excel

### 5. Pick Random Students

- Apply filters to narrow down pool
- Specify number of students to pick
- Export selected students

### 6. Company Analytics

- View hiring patterns
- Analyze stipend comparisons
- See branch distributions

## 📊 Data Format

The Excel template includes these columns:

- **Student Info:** Name, Email, Phone, Roll No, Branch, Year
- **Company Info:** Company Name, Location, Website
- **Internship Details:** Title, Type, Duration, Start Date, End Date, Stipend, Status
- **Mentor Info:** Name, Email, Designation
- **Evaluation:** Rating, Feedback, Skills

### Supported Branches:
- `comps` - Computer Engineering
- `extc` - Electronics & Telecommunication
- `cse` - Computer Science & Engineering
- `mca` - Master of Computer Applications
- `aiml` - Artificial Intelligence & Machine Learning

### Status Values:
- `pending` - Awaiting approval
- `approved` - Approved by coordinator
- `in-progress` - Currently ongoing
- `completed` - Finished
- `cancelled` - Cancelled/Withdrawn

## 🔧 Troubleshooting

### MongoDB Connection Error

**Error:** "MongooseServerSelectionError: connect ECONNREFUSED"

**Solution:**
1. Ensure MongoDB is running
2. Check if the port (27017) is correct
3. Verify MONGODB_URI in `.env` file

### Port Already in Use

**Error:** "Port 5000 is already in use"

**Solution:**
1. Change PORT in `.env` file to another port (e.g., 5001)
2. Or kill the process using that port:
   ```powershell
   # Windows
   netstat -ano | findstr :5000
   taskkill /PID <PID> /F
   ```

### Frontend Not Loading

**Error:** Blank page or errors in console

**Solution:**
1. Clear browser cache
2. Check if backend is running
3. Verify REACT_APP_API_URL in frontend/.env
4. Check browser console for errors

### Excel Upload Not Working

**Solution:**
1. Ensure file is in .xlsx or .xls format
2. Check that required columns exist
3. Verify branch names are lowercase
4. Check status values match allowed values

## 🛠️ Development

### Project Structure

```
Internship_portal/
├── backend/
│   ├── models/         # MongoDB schemas
│   ├── routes/         # API routes
│   └── server.js       # Express server
├── frontend/
│   ├── public/
│   └── src/
│       ├── api/        # API calls
│       ├── components/ # React components
│       └── pages/      # Page components
├── package.json
├── .env
└── README.md
```

### API Endpoints

#### Internships
- `GET /api/internships` - Get all internships with filters
- `GET /api/internships/:id` - Get single internship
- `POST /api/internships` - Create internship
- `PUT /api/internships/:id` - Update internship
- `DELETE /api/internships/:id` - Delete internship
- `GET /api/internships/stats/summary` - Get summary stats

#### Upload
- `POST /api/upload/excel` - Parse Excel file
- `POST /api/upload/import` - Import to database
- `GET /api/upload/template` - Download template

#### Analytics
- `GET /api/analytics/companies` - Company statistics
- `GET /api/analytics/branches` - Branch distribution
- `GET /api/analytics/status` - Status distribution
- `GET /api/analytics/summary` - Complete summary

#### Groups
- `POST /api/groups/generate` - Generate groups
- `POST /api/groups/export` - Export to Excel
- `POST /api/groups/random-pick` - Pick random students
- `POST /api/groups/export-random` - Export random students

## 📝 Sample Data

Want to test with sample data? Use the Excel template with these examples:

1. Download template from Upload page
2. Fill with sample student data
3. Upload and import
4. Explore the features!

## 🆘 Support

For issues or questions:
1. Check this guide first
2. Review error messages in terminal
3. Check browser console (F12)
4. Contact the development team

## 🔒 Security Note

This portal currently has **no authentication**. It's designed for internal use within SPIT network.

For production deployment:
- Add authentication/authorization
- Use HTTPS
- Secure MongoDB connection
- Add input validation
- Implement rate limiting

## 📄 License

Internal SPIT project - ISC License

---

**Happy Managing! 🎓**













