# 🚀 Deployment Guide - SPIT Internship Portal

## Deployment Options

### Option 1: Local Network (SPIT Internal)

Deploy on a computer within the SPIT network that other users can access.

#### Requirements:
- Computer that stays on during working hours
- Static IP or hostname on SPIT network
- MongoDB installed locally or Atlas connection
- Node.js installed

#### Steps:

1. **Set up the application:**
```powershell
npm install
cd frontend
npm install
cd ..
```

2. **Configure environment:**

Edit `.env` file:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/spit-internships
NODE_ENV=production
```

3. **Build frontend:**
```powershell
cd frontend
npm run build
cd ..
```

4. **Install PM2 (Process Manager):**
```powershell
npm install -g pm2
```

5. **Start application:**
```powershell
pm2 start backend/server.js --name "spit-internship-backend"
pm2 startup
pm2 save
```

6. **Set up static file serving:**

Update `backend/server.js` to serve the React build:
```javascript
const path = require('path');

// Add this after your routes
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}
```

7. **Access the application:**
- From other computers: `http://<server-ip>:5000`
- Update REACT_APP_API_URL in frontend/.env before building

---

### Option 2: Cloud Deployment (Heroku)

#### Prerequisites:
- Heroku account (free tier available)
- Heroku CLI installed
- Git initialized in project

#### Steps:

1. **Create Heroku app:**
```bash
heroku login
heroku create spit-internship-portal
```

2. **Add MongoDB Atlas:**
```bash
# Sign up for MongoDB Atlas (free tier)
# Get connection string
heroku config:set MONGODB_URI="your-mongodb-atlas-connection-string"
```

3. **Create Procfile:**
```
web: node backend/server.js
```

4. **Update package.json scripts:**
```json
{
  "scripts": {
    "start": "node backend/server.js",
    "heroku-postbuild": "cd frontend && npm install && npm run build"
  }
}
```

5. **Deploy:**
```bash
git add .
git commit -m "Deploy to Heroku"
git push heroku main
```

6. **Access:**
```
https://spit-internship-portal.herokuapp.com
```

---

### Option 3: Vercel (Frontend) + Render (Backend)

#### Frontend on Vercel:

1. **Connect GitHub repository to Vercel**
2. **Configure build settings:**
   - Build Command: `cd frontend && npm run build`
   - Output Directory: `frontend/build`
3. **Add environment variable:**
   - `REACT_APP_API_URL`: Your backend URL

#### Backend on Render:

1. **Create Web Service on Render**
2. **Configure:**
   - Build Command: `npm install`
   - Start Command: `node backend/server.js`
3. **Add environment variables:**
   - `MONGODB_URI`: Your MongoDB connection string
   - `PORT`: 5000
   - `NODE_ENV`: production

---

### Option 4: Docker Deployment

#### Create Dockerfile (Backend):
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY backend ./backend
COPY .env ./.env

EXPOSE 5000

CMD ["node", "backend/server.js"]
```

#### Create Dockerfile (Frontend):
```dockerfile
FROM node:18-alpine as build

WORKDIR /app

COPY frontend/package*.json ./
RUN npm install

COPY frontend ./
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### Docker Compose:
```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:latest
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db

  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    ports:
      - "5000:5000"
    environment:
      - MONGODB_URI=mongodb://mongodb:27017/spit-internships
    depends_on:
      - mongodb

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  mongodb_data:
```

**Run with Docker:**
```bash
docker-compose up -d
```

---

## Production Configuration

### Security Checklist

✅ **Add Authentication:**
- Implement login system for coordinators
- Use JWT tokens or session-based auth
- Secure all API endpoints

✅ **Environment Variables:**
- Never commit `.env` file
- Use strong MongoDB passwords
- Rotate API keys regularly

✅ **CORS Configuration:**
```javascript
// backend/server.js
const corsOptions = {
  origin: 'https://your-frontend-domain.com',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
```

✅ **Input Validation:**
- Validate all user inputs
- Sanitize data before database operations
- Use express-validator

✅ **Rate Limiting:**
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

✅ **HTTPS:**
- Use SSL certificates
- Redirect HTTP to HTTPS
- Use secure cookies

✅ **MongoDB Security:**
- Enable authentication
- Use connection string with credentials
- Limit network access
- Regular backups

---

## Performance Optimization

### Backend:
1. **Enable compression:**
```javascript
const compression = require('compression');
app.use(compression());
```

2. **Add caching:**
```javascript
const redis = require('redis');
// Cache frequently accessed data
```

3. **Database indexing:**
```javascript
// In your model
internshipSchema.index({ 'student.branch': 1, 'internship.status': 1 });
```

### Frontend:
1. **Code splitting**
2. **Lazy loading components**
3. **Image optimization**
4. **Minification (automatic with build)**

---

## Monitoring & Maintenance

### Logging:
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

### Health Checks:
Already implemented at `/api/health`

### Monitoring Tools:
- **PM2 Monitoring**: `pm2 monit`
- **MongoDB Atlas Monitoring**: Built-in dashboard
- **Uptime Monitoring**: UptimeRobot, Pingdom
- **Error Tracking**: Sentry

---

## Backup Strategy

### Database Backups:

**Automated (MongoDB Atlas):**
- Configure automatic backups in Atlas dashboard

**Manual (Local MongoDB):**
```bash
# Backup
mongodump --db spit-internships --out ./backup

# Restore
mongorestore --db spit-internships ./backup/spit-internships
```

### Application Backups:
- Version control with Git
- Regular commits and pushes
- Tag releases: `git tag v1.0.0`

---

## Scaling Considerations

### For Large Datasets:

1. **Implement Pagination:**
```javascript
const page = parseInt(req.query.page) || 1;
const limit = parseInt(req.query.limit) || 20;
const skip = (page - 1) * limit;

const internships = await Internship.find(query)
  .limit(limit)
  .skip(skip);
```

2. **Database Optimization:**
- Add indexes on frequently queried fields
- Use aggregation pipeline for complex queries
- Consider sharding for very large datasets

3. **Load Balancing:**
- Multiple backend instances
- Reverse proxy (Nginx)
- CDN for static assets

---

## Support & Maintenance

### Regular Tasks:
- [ ] Weekly database backups
- [ ] Monthly dependency updates: `npm outdated`
- [ ] Security audits: `npm audit`
- [ ] Performance monitoring
- [ ] User feedback collection

### Update Procedure:
1. Test updates in development
2. Create backup
3. Deploy to staging
4. Test thoroughly
5. Deploy to production
6. Monitor for issues

---

## Cost Estimate (Cloud Deployment)

### Free Tier Option:
- **MongoDB Atlas**: Free (512MB storage)
- **Heroku**: Free (sleeps after inactivity)
- **Vercel**: Free (for personal projects)
- **Total**: $0/month

### Production Option:
- **MongoDB Atlas**: $9-25/month
- **Heroku/Render**: $7-25/month
- **Domain**: $10-15/year
- **Total**: ~$20-50/month

---

## Rollback Plan

If deployment fails:

1. **Keep previous version:**
```bash
git tag v1.0.0-stable
```

2. **Rollback command:**
```bash
git checkout v1.0.0-stable
heroku rollback
# or
pm2 restart spit-internship-backend
```

3. **Database rollback:**
```bash
mongorestore --db spit-internships ./backup/previous
```

---

**Choose the deployment option that best fits your needs!**

For SPIT internal use, **Option 1 (Local Network)** is recommended.
For external access, consider **Option 2 (Heroku)** or **Option 3 (Vercel + Render)**.





