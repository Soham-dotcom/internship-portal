# 🚀 Quick Start - SPIT Internship Portal

Welcome to the SPIT Internship Management & Analytics Portal!

## ⚡ Fast Setup (5 Minutes)

### Step 1: Install Dependencies (2 minutes)

```powershell
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### Step 2: Start MongoDB (30 seconds)

**If MongoDB is installed locally:**
- It should start automatically as a Windows service
- Or open a new terminal and run: `mongod`

**If using MongoDB Atlas (Cloud):**
- Update the `MONGODB_URI` in the `.env` file with your connection string

### Step 3: Run the Application (30 seconds)

```powershell
# This starts both backend and frontend
npm run dev
```

**That's it!** 🎉

### Step 4: Access the Application

Open your browser and go to:
```
http://localhost:3000
```

The backend API runs on:
```
http://localhost:5000
```

---

## 📚 What to Do Next?

### 1. Add Sample Data

1. Click on **"Upload Excel"** in the sidebar
2. Download the template Excel file
3. Fill it with sample student internship data
4. Upload and import it to the database

### 2. Explore Features

- **Dashboard** - View statistics and charts
- **Internships** - See all records with filters
- **Group Generator** - Create student groups
- **Student Picker** - Randomly select students
- **Analytics** - Analyze company trends

---

## 📖 Documentation

- **SETUP_GUIDE.md** - Detailed installation instructions
- **FEATURES.md** - Complete feature documentation
- **API_DOCUMENTATION.md** - API endpoints reference
- **README.md** - Project overview

---

## ❓ Common Issues

### MongoDB Connection Error?
```
Error: connect ECONNREFUSED
```
**Solution:** Make sure MongoDB is running. If using Windows, check Services or start manually with `mongod`.

### Port Already in Use?
```
Error: Port 5000 is already in use
```
**Solution:** Change the PORT in `.env` file to another port like 5001.

### Frontend Won't Load?
**Solution:** 
1. Make sure backend is running first
2. Clear browser cache
3. Check console for errors (Press F12)

---

## 🎯 Quick Test

Try this to verify everything works:

1. ✅ Backend: Visit http://localhost:5000/api/health
   - Should show: `{"status":"OK","message":"Server is running"}`

2. ✅ Frontend: Visit http://localhost:3000
   - Should show the Dashboard page

3. ✅ Database: Check the Dashboard
   - Even with 0 data, it should load without errors

---

## 🛠️ Development Commands

```powershell
# Run both backend and frontend together
npm run dev

# Run backend only
npm run server

# Run frontend only (from frontend folder)
cd frontend
npm start

# Install all dependencies
npm run install-all
```

---

## 📊 Data Model

Each internship record contains:

**Student Info:**
- Name, Email, Phone, Roll No
- Branch (comps/extc/cse/mca/aiml)
- Year, Avatar (optional)

**Company Info:**
- Name, Location, Website

**Internship Details:**
- Title, Type, Duration
- Start Date, End Date
- Stipend, Status

**Mentor Info:**
- Name, Email, Designation

**Evaluation:**
- Rating (0-5), Feedback, Skills

---

## 🎓 Built For

- SPIT Coordinators
- Faculty Mentors
- Internship Management
- Student Analytics

---

## 💡 Tips

1. **Always keep MongoDB running** when using the app
2. **Use the Excel template** for consistent data format
3. **Apply filters** to find specific internships quickly
4. **Export data** whenever you need reports
5. **No authentication** means easy access for your team

---

## 🆘 Need Help?

1. Check SETUP_GUIDE.md for detailed instructions
2. Review error messages in terminal
3. Check browser console (F12 in browser)
4. Verify all dependencies are installed
5. Ensure MongoDB is running

---

## ✨ Features at a Glance

✅ Dashboard with real-time statistics  
✅ Advanced filtering system  
✅ Excel import/export  
✅ Random student picker  
✅ Group generator  
✅ Company analytics  
✅ Beautiful, responsive UI  
✅ No authentication needed  

---

**Ready to manage internships like a pro!** 🎯

Start exploring the portal now at http://localhost:3000





