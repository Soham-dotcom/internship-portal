# 🚀 How to Start the SPIT Internship Portal

## Quick Start (3 Steps)

### Step 1: Check if MongoDB is Running

**Option A: MongoDB is installed locally**
1. Press `Win + R`, type `services.msc`, press Enter
2. Look for "MongoDB" or "MongoDB Server"
3. If it says "Running" → Great! Skip to Step 2
4. If not running → Right-click → Start

**Option B: Don't have MongoDB?**
You have two choices:
- Install MongoDB Community: https://www.mongodb.com/try/download/community
- Use MongoDB Atlas (free cloud): https://www.mongodb.com/cloud/atlas

If using Atlas, update `.env` file:
```
MONGODB_URI=your-atlas-connection-string
```

---

### Step 2: Open TWO Terminals

You need to run backend and frontend separately.

**Terminal 1 (Backend):**
```powershell
cd C:\Users\soham\OneDrive\Desktop\Internship_portal
npm run server
```

**Terminal 2 (Frontend):**
```powershell
cd C:\Users\soham\OneDrive\Desktop\Internship_portal\frontend
npm start
```

---

### Step 3: Access the Application

After both start successfully:
- Frontend will open automatically at: **http://localhost:3000**
- Backend API runs at: **http://localhost:5000**

---

## ✅ Success Indicators

**Backend Terminal should show:**
```
Server is running on port 5000
MongoDB connected successfully
```

**Frontend Terminal should show:**
```
Compiled successfully!
webpack compiled with X warnings
```

**Browser should open automatically to http://localhost:3000**

---

## 🎯 What to Do After It Starts

1. **Dashboard loads** → You'll see "0" in all cards (no data yet)
2. **Click "Upload Excel"** in the sidebar
3. **Download Template** button
4. **Fill the template** with sample data
5. **Upload and Import** the data
6. **Go back to Dashboard** → Now you'll see your data!

---

## 🔧 Troubleshooting

### If Backend Shows: "Cannot find module 'express'"
```powershell
cd C:\Users\soham\OneDrive\Desktop\Internship_portal
npm install
```

### If MongoDB Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Solution:** Start MongoDB service (see Step 1)

### If Port 3000 or 5000 Already in Use
```
Error: Port XXXX is already in use
```
**Solution:** 
1. Close any other applications using that port
2. Or change the port in `.env` file

### If Frontend Shows "Proxy Error"
**Solution:** Make sure backend is running first!

---

## 🎓 Sample Data Template

| Student Name | Student Email | Student Phone | Roll No | Branch | Year | Company Name | Company Location | Internship Title | Internship Type | Duration | Start Date | End Date | Stipend | Status | Mentor Name | Mentor Email | Mentor Designation |
|--------------|---------------|---------------|---------|--------|------|--------------|------------------|------------------|-----------------|----------|------------|----------|---------|--------|-------------|--------------|-------------------|
| John Doe | john@student.spit.ac.in | 9876543210 | COMPS001 | comps | 2024 | Tech Corp | Mumbai | Software Developer | Technical | 3 months | 2024-06-01 | 2024-08-31 | 15000 | completed | Dr. Smith | smith@spit.ac.in | Professor |

---

## 💡 Pro Tips

1. **Keep both terminals open** while using the app
2. **Don't close MongoDB** service
3. **Use Ctrl+C** in terminals to stop servers
4. **Refresh browser** if something doesn't load
5. **Check terminal** for any error messages

---

## 🛑 How to Stop

**To stop the application:**
1. Go to each terminal
2. Press `Ctrl + C`
3. Type `Y` if asked to terminate

---

## 🚀 Restart Anytime

Just repeat Step 2:
- Terminal 1: `npm run server`
- Terminal 2: `cd frontend` then `npm start`

---

**Ready? Let's start! 🎉**













