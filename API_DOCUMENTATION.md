# SPIT Internship Portal - API Documentation

## Base URL
```
http://localhost:5000/api
```

## Response Format

All API responses follow this format:

```json
{
  "success": true/false,
  "data": {...},
  "message": "Success/Error message",
  "count": 10  // Optional: number of records
}
```

---

## 📝 Internships API

### Get All Internships
**GET** `/internships`

Get all internships with optional filters.

**Query Parameters:**
- `branch` (string) - Filter by branch (comps, extc, cse, mca, aiml)
- `company` (string) - Search by company name
- `status` (string) - Filter by status
- `mentor` (string) - Search by mentor name
- `year` (string) - Filter by year
- `type` (string) - Filter by internship type
- `startDate` (date) - Filter by start date (from)
- `endDate` (date) - Filter by start date (to)

**Example:**
```
GET /api/internships?branch=comps&status=completed
```

**Response:**
```json
{
  "success": true,
  "data": [...],
  "count": 15
}
```

### Get Single Internship
**GET** `/internships/:id`

Get details of a specific internship.

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "student": {...},
    "company": {...},
    "internship": {...},
    "mentor": {...},
    "evaluation": {...}
  }
}
```

### Create Internship
**POST** `/internships`

Create a new internship record.

**Request Body:**
```json
{
  "student": {
    "name": "John Doe",
    "email": "john@student.spit.ac.in",
    "phone": "9876543210",
    "rollNo": "COMPS001",
    "branch": "comps",
    "year": "2024",
    "avatar": ""
  },
  "company": {
    "name": "Tech Corp",
    "location": "Mumbai",
    "website": "https://techcorp.com"
  },
  "internship": {
    "title": "Software Developer Intern",
    "type": "Technical",
    "duration": "3 months",
    "startDate": "2024-06-01",
    "endDate": "2024-08-31",
    "stipend": "15000",
    "status": "pending"
  },
  "mentor": {
    "name": "Dr. Smith",
    "email": "smith@spit.ac.in",
    "designation": "Professor"
  },
  "evaluation": {
    "rating": 0,
    "feedback": "",
    "skills": ["JavaScript", "React"]
  }
}
```

### Update Internship
**PUT** `/internships/:id`

Update an existing internship record.

**Request Body:** Same as create, with fields to update.

### Delete Internship
**DELETE** `/internships/:id`

Delete an internship record.

**Response:**
```json
{
  "success": true,
  "message": "Internship deleted successfully"
}
```

### Get Summary Statistics
**GET** `/internships/stats/summary`

Get dashboard summary statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalStudents": 150,
    "totalCompanies": 45,
    "completedInternships": 80,
    "pendingApprovals": 15,
    "branchWiseCount": [
      { "_id": "comps", "count": 50 },
      { "_id": "extc", "count": 30 }
    ]
  }
}
```

---

## 📤 Upload API

### Upload Excel File
**POST** `/upload/excel`

Parse an Excel file and return mapped data.

**Content-Type:** `multipart/form-data`

**Form Data:**
- `file` - Excel file (.xlsx or .xls)

**Response:**
```json
{
  "success": true,
  "message": "File parsed successfully",
  "data": [...],
  "count": 25
}
```

### Import Data
**POST** `/upload/import`

Import parsed data to MongoDB.

**Request Body:**
```json
{
  "internships": [
    {
      "student": {...},
      "company": {...},
      "internship": {...},
      "mentor": {...},
      "evaluation": {...}
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully imported 25 internships",
  "count": 25
}
```

### Download Template
**GET** `/upload/template`

Download Excel template file.

**Response:** Excel file download

---

## 📊 Analytics API

### Company Analytics
**GET** `/analytics/companies`

Get company-wise hiring statistics.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "Tech Corp",
      "count": 25,
      "location": "Mumbai",
      "students": ["John Doe", "Jane Smith"]
    }
  ]
}
```

### Branch Analytics
**GET** `/analytics/branches`

Get branch distribution.

**Response:**
```json
{
  "success": true,
  "data": [
    { "_id": "comps", "count": 50 },
    { "_id": "extc", "count": 30 }
  ]
}
```

### Status Analytics
**GET** `/analytics/status`

Get status distribution.

**Response:**
```json
{
  "success": true,
  "data": [
    { "_id": "completed", "count": 80 },
    { "_id": "in-progress", "count": 40 }
  ]
}
```

### Company-Branch Analytics
**GET** `/analytics/companies/branches`

Get branch distribution within each company.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "Tech Corp",
      "branches": [
        { "branch": "comps", "count": 15 },
        { "branch": "extc", "count": 10 }
      ],
      "total": 25
    }
  ]
}
```

### Stipend Analytics
**GET** `/analytics/stipends`

Get stipend comparison across companies.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "Tech Corp",
      "avgStipend": 15000,
      "minStipend": 10000,
      "maxStipend": 20000,
      "count": 25
    }
  ]
}
```

### Type Analytics
**GET** `/analytics/types`

Get internship type distribution.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "Technical",
      "count": 100,
      "companies": ["Tech Corp", "IT Solutions"]
    }
  ]
}
```

### Analytics Summary
**GET** `/analytics/summary`

Get comprehensive analytics summary.

**Response:**
```json
{
  "success": true,
  "data": {
    "companies": [...],
    "branches": [...],
    "status": [...],
    "types": [...]
  }
}
```

---

## 👥 Groups API

### Generate Groups
**POST** `/groups/generate`

Generate student groups based on filters.

**Request Body:**
```json
{
  "filters": {
    "branch": "comps",
    "company": "Tech Corp",
    "status": "completed",
    "year": "2024"
  },
  "groupSize": 5,
  "numGroups": null,
  "randomize": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "groups": [
      {
        "groupNumber": 1,
        "students": [
          {
            "name": "John Doe",
            "email": "john@student.spit.ac.in",
            "rollNo": "COMPS001",
            "branch": "comps",
            "year": "2024",
            "company": "Tech Corp",
            "internshipTitle": "Software Developer",
            "status": "completed"
          }
        ]
      }
    ],
    "totalStudents": 25,
    "totalGroups": 5
  }
}
```

### Export Groups
**POST** `/groups/export`

Export groups to Excel file.

**Request Body:**
```json
{
  "groups": [
    {
      "groupNumber": 1,
      "students": [...]
    }
  ]
}
```

**Response:** Excel file download

### Random Pick Students
**POST** `/groups/random-pick`

Randomly select students based on filters.

**Request Body:**
```json
{
  "filters": {
    "branch": "comps",
    "status": "completed"
  },
  "count": 5
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "John Doe",
      "email": "john@student.spit.ac.in",
      "rollNo": "COMPS001",
      "branch": "comps",
      "year": "2024",
      "phone": "9876543210",
      "company": "Tech Corp",
      "internshipTitle": "Software Developer",
      "status": "completed",
      "mentor": "Dr. Smith"
    }
  ],
  "totalAvailable": 50,
  "picked": 5
}
```

### Export Random Students
**POST** `/groups/export-random`

Export randomly picked students to Excel.

**Request Body:**
```json
{
  "students": [...]
}
```

**Response:** Excel file download

---

## 🔍 Error Handling

### Error Response Format
```json
{
  "success": false,
  "message": "Error description"
}
```

### Common HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `404` - Not Found
- `500` - Internal Server Error

### Common Error Messages
- "No file uploaded" - File missing in upload request
- "Invalid data format" - Request body doesn't match schema
- "Internship not found" - Record doesn't exist
- "No students found matching the filters" - Empty result set

---

## 🧪 Testing with Postman/cURL

### Example cURL Commands

**Get all internships:**
```bash
curl http://localhost:5000/api/internships
```

**Get filtered internships:**
```bash
curl "http://localhost:5000/api/internships?branch=comps&status=completed"
```

**Create internship:**
```bash
curl -X POST http://localhost:5000/api/internships \
  -H "Content-Type: application/json" \
  -d '{...}'
```

**Upload Excel:**
```bash
curl -X POST http://localhost:5000/api/upload/excel \
  -F "file=@internships.xlsx"
```

**Generate groups:**
```bash
curl -X POST http://localhost:5000/api/groups/generate \
  -H "Content-Type: application/json" \
  -d '{"filters": {"branch": "comps"}, "groupSize": 5, "randomize": true}'
```

---

## 📝 Notes

1. **Date Format:** ISO 8601 format (YYYY-MM-DD or full ISO string)
2. **Branch Values:** Must be lowercase (comps, extc, cse, mca, aiml)
3. **Status Values:** pending, approved, in-progress, completed, cancelled
4. **File Upload:** Use multipart/form-data for Excel uploads
5. **CORS:** Enabled for all origins in development
6. **Case Sensitivity:** Search queries are case-insensitive

---

## 🔐 Security Considerations

For production deployment:
- Add authentication middleware
- Validate all input data
- Sanitize user inputs
- Implement rate limiting
- Use HTTPS
- Secure MongoDB connection
- Add API key authentication

---

**Version:** 1.0.0  
**Last Updated:** 2024













