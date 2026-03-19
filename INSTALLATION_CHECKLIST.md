# ✅ Installation Checklist - SPIT Internship Portal

Follow this checklist to ensure proper installation and setup.

---

## Pre-Installation

### System Requirements
- [ ] Node.js v14 or higher installed
  - Check: `node --version`
  - Download: https://nodejs.org/

- [ ] MongoDB installed (local) OR MongoDB Atlas account (cloud)
  - Local: https://www.mongodb.com/try/download/community
  - Atlas: https://www.mongodb.com/cloud/atlas

- [ ] npm or yarn package manager
  - Check: `npm --version`
  - Comes with Node.js

- [ ] Git (optional, for version control)
  - Check: `git --version`
  - Download: https://git-scm.com/

---

## Installation Steps

### Step 1: Backend Setup
- [ ] Navigate to project root
- [ ] Run `npm install`
- [ ] Verify `node_modules` folder created
- [ ] Check for any installation errors

### Step 2: Frontend Setup
- [ ] Navigate to `frontend` folder
- [ ] Run `npm install`
- [ ] Verify `node_modules` folder created in frontend
- [ ] Check for any installation errors

### Step 3: Environment Configuration
- [ ] Verify `.env` file exists in project root
- [ ] Check MongoDB connection string in `.env`
  ```
  MONGODB_URI=mongodb://localhost:27017/spit-internships
  ```
- [ ] Update if using MongoDB Atlas
- [ ] Verify PORT=5000 or change if needed

### Step 4: Database Setup
- [ ] Start MongoDB service (if local)
  - Windows: Check Services or run `mongod`
  - Mac: `brew services start mongodb-community`
  - Linux: `sudo systemctl start mongod`

- [ ] Test MongoDB connection
  - Open terminal: `mongo` or `mongosh`
  - Should connect without errors

### Step 5: Verify File Structure
- [ ] `backend/` folder exists
  - [ ] `models/Internship.js`
  - [ ] `routes/` folder with 4 files
  - [ ] `server.js`

- [ ] `frontend/` folder exists
  - [ ] `src/api/axios.js`
  - [ ] `src/components/` folder
  - [ ] `src/pages/` folder with 6 files
  - [ ] `package.json`

- [ ] Root files exist
  - [ ] `package.json`
  - [ ] `.env`
  - [ ] README files

---

## First Run

### Start Application
- [ ] Open terminal in project root
- [ ] Run: `npm run dev`
- [ ] Wait for both servers to start
- [ ] Check for error messages

### Verify Backend
- [ ] Backend should start on port 5000
- [ ] Check terminal for "Server is running on port 5000"
- [ ] Check terminal for "MongoDB connected successfully"
- [ ] Open browser: http://localhost:5000/api/health
- [ ] Should see: `{"status":"OK","message":"Server is running"}`

### Verify Frontend
- [ ] Frontend should start on port 3000
- [ ] Browser should open automatically
- [ ] URL: http://localhost:3000
- [ ] Dashboard page should load
- [ ] No errors in browser console (F12)

---

## Initial Data Setup

### Upload Sample Data
- [ ] Click "Upload Excel" in sidebar
- [ ] Click "Download Excel Template"
- [ ] Template downloads successfully
- [ ] Open template in Excel/LibreOffice
- [ ] Fill with sample data (at least 5 records)
- [ ] Save the file
- [ ] Upload file in application
- [ ] Click "Parse File"
- [ ] Preview shows data correctly
- [ ] Click "Import to Database"
- [ ] Success message appears

### Verify Data
- [ ] Go to Dashboard
- [ ] Summary cards show correct numbers
- [ ] Charts display with data
- [ ] Go to Internship List
- [ ] Table shows uploaded records
- [ ] Filters work correctly

---

## Feature Testing

### Dashboard
- [ ] Summary cards display numbers
- [ ] Bar chart shows companies
- [ ] Pie chart shows branches
- [ ] Status chart displays
- [ ] All charts are interactive
- [ ] No console errors

### Internship List
- [ ] All records display in table
- [ ] Branch filter works
- [ ] Status filter works
- [ ] Company search works
- [ ] Multiple filters work together
- [ ] "Export to Excel" downloads file
- [ ] Exported file opens correctly

### Excel Upload
- [ ] Template download works
- [ ] File upload accepts .xlsx
- [ ] Parse shows preview
- [ ] Import creates records
- [ ] Duplicate handling works

### Group Generator
- [ ] Filters apply correctly
- [ ] Group size setting works
- [ ] Groups generate successfully
- [ ] Groups display properly
- [ ] Export creates multi-sheet file
- [ ] Excel file has separate sheets per group

### Student Picker
- [ ] Filters apply correctly
- [ ] Number input works
- [ ] Random selection works
- [ ] Results display as cards
- [ ] Each run gives different results
- [ ] Export downloads file

### Company Analytics
- [ ] Top companies chart displays
- [ ] Type pie chart shows
- [ ] Stipend chart displays
- [ ] Branch distribution shows
- [ ] Company table populates
- [ ] All data is accurate

---

## Troubleshooting Checklist

### If Backend Won't Start
- [ ] MongoDB is running
- [ ] Port 5000 is available
- [ ] .env file is configured
- [ ] Dependencies installed correctly
- [ ] No syntax errors in server.js

### If Frontend Won't Start
- [ ] Port 3000 is available
- [ ] Dependencies installed in frontend/
- [ ] No syntax errors in code
- [ ] TailwindCSS installed
- [ ] React scripts are working

### If MongoDB Connection Fails
- [ ] MongoDB service is running
- [ ] Connection string is correct
- [ ] Database permissions are set
- [ ] Network allows connection
- [ ] Port 27017 is open (default)

### If Data Not Showing
- [ ] Backend is running
- [ ] MongoDB has data
- [ ] API calls succeeding
- [ ] Check browser console (F12)
- [ ] Check Network tab in DevTools
- [ ] API endpoint URLs are correct

### If Excel Upload Fails
- [ ] File is .xlsx or .xls format
- [ ] Required columns exist
- [ ] Data format matches template
- [ ] Branch names are lowercase
- [ ] Status values are valid
- [ ] Dates are in correct format

---

## Performance Check

### Backend
- [ ] API responds in < 1 second
- [ ] Database queries are fast
- [ ] No memory leaks
- [ ] Error handling works
- [ ] Logs show no errors

### Frontend
- [ ] Pages load quickly
- [ ] Charts render smoothly
- [ ] Filters update in real-time
- [ ] No UI lag
- [ ] Mobile responsive

---

## Security Check (Pre-Production)

### Before Deploying
- [ ] Change default MongoDB credentials
- [ ] Use strong passwords
- [ ] Enable MongoDB authentication
- [ ] Configure CORS properly
- [ ] Add rate limiting
- [ ] Implement authentication
- [ ] Use HTTPS
- [ ] Validate all inputs
- [ ] Sanitize user data
- [ ] Set up backups

---

## Final Verification

### Complete System Test
- [ ] Upload data via Excel
- [ ] View in Dashboard
- [ ] Filter in Internship List
- [ ] Export filtered data
- [ ] Generate groups
- [ ] Export groups to Excel
- [ ] Pick random students
- [ ] Export random students
- [ ] View all analytics
- [ ] All features working
- [ ] No console errors
- [ ] No server errors

---

## Documentation Review

- [ ] Read START_HERE.md
- [ ] Review SETUP_GUIDE.md
- [ ] Check FEATURES.md
- [ ] Review API_DOCUMENTATION.md
- [ ] Check DEPLOYMENT.md (if deploying)
- [ ] Review PROJECT_SUMMARY.md

---

## Post-Installation

### Maintenance Setup
- [ ] Set up regular MongoDB backups
- [ ] Configure error logging
- [ ] Set up monitoring (optional)
- [ ] Document any custom changes
- [ ] Train users on the system

### Optional Enhancements
- [ ] Add authentication
- [ ] Set up HTTPS
- [ ] Configure domain name
- [ ] Add analytics tracking
- [ ] Set up automated backups

---

## Success Criteria

Your installation is successful when:
- ✅ Backend starts without errors
- ✅ Frontend loads in browser
- ✅ MongoDB connects successfully
- ✅ Sample data imports successfully
- ✅ Dashboard displays data
- ✅ All pages are accessible
- ✅ All features work correctly
- ✅ Excel import/export works
- ✅ Charts display properly
- ✅ No console errors

---

## Support

If you checked all items and still have issues:

1. **Check Logs:**
   - Terminal output for errors
   - Browser console (F12)
   - MongoDB logs

2. **Review Documentation:**
   - START_HERE.md for quick fixes
   - SETUP_GUIDE.md for detailed help
   - API_DOCUMENTATION.md for API issues

3. **Common Issues:**
   - Port conflicts → Change port in .env
   - MongoDB not running → Start service
   - Dependencies missing → Run npm install again

4. **Get Help:**
   - Check error messages carefully
   - Search for specific error online
   - Review GitHub issues (if applicable)
   - Contact development team

---

## Completion

- [ ] All checklist items completed
- [ ] System fully functional
- [ ] Data successfully imported
- [ ] All features tested
- [ ] Ready for production use

**Congratulations! Your SPIT Internship Portal is ready! 🎉**

---

**Last Updated:** 2024-11-23  
**Version:** 1.0.0













