const mongoose = require('mongoose');
const Internship = require('./models/Internship');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/spit-internships';

const sampleData = [
  // High-paying tech companies
  { email: 'john.doe@spit.ac.in', name: 'John Doe', uid: '2021300001', branch: 'COMPS', internshipType: 'Off-Campus', companyName: 'Google', externalMentorName: 'Rajesh Kumar', startDate: new Date('2025-01-15'), endDate: new Date('2025-07-15'), salary: 75000, duration: 6, status: 'completed' },
  { email: 'jane.smith@spit.ac.in', name: 'Jane Smith', uid: '2021300002', branch: 'IT', internshipType: 'Off-Campus', companyName: 'Microsoft', externalMentorName: 'Priya Sharma', startDate: new Date('2025-01-10'), endDate: new Date('2025-07-10'), salary: 70000, duration: 6, status: 'completed' },
  { email: 'raj.patel@spit.ac.in', name: 'Raj Patel', uid: '2021300003', branch: 'COMPS', internshipType: 'Off-Campus', companyName: 'Amazon', externalMentorName: 'Amit Desai', startDate: new Date('2025-02-01'), endDate: new Date('2025-08-01'), salary: 65000, duration: 6, status: 'in-progress' },
  { email: 'priya.mehta@spit.ac.in', name: 'Priya Mehta', uid: '2021300004', branch: 'EXTC', internshipType: 'Off-Campus', companyName: 'Meta', externalMentorName: 'Sanjay Verma', startDate: new Date('2025-01-20'), endDate: new Date('2025-07-20'), salary: 68000, duration: 6, status: 'in-progress' },
  { email: 'amit.shah@spit.ac.in', name: 'Amit Shah', uid: '2021300005', branch: 'IT', internshipType: 'On-Campus', companyName: 'TCS', externalMentorName: 'Neha Gupta', startDate: new Date('2025-01-05'), endDate: new Date('2025-04-05'), salary: 15000, duration: 3, status: 'completed' },
  
  // Mid-range companies
  { email: 'sneha.reddy@spit.ac.in', name: 'Sneha Reddy', uid: '2021300006', branch: 'CSE', internshipType: 'Off-Campus', companyName: 'Infosys', externalMentorName: 'Vikram Singh', startDate: new Date('2025-02-15'), endDate: new Date('2025-05-15'), salary: 20000, duration: 3, status: 'approved' },
  { email: 'karan.joshi@spit.ac.in', name: 'Karan Joshi', uid: '2021300007', branch: 'COMPS', internshipType: 'On-Campus', companyName: 'Wipro', externalMentorName: 'Anjali Iyer', startDate: new Date('2025-01-08'), endDate: new Date('2025-07-08'), salary: 18000, duration: 6, status: 'in-progress' },
  { email: 'ananya.nair@spit.ac.in', name: 'Ananya Nair', uid: '2021300008', branch: 'MCA', internshipType: 'College-Arranged', companyName: 'Accenture', externalMentorName: 'Ramesh Patil', startDate: new Date('2025-02-01'), endDate: new Date('2025-07-01'), salary: 25000, duration: 5, status: 'in-progress' },
  { email: 'rohan.kumar@spit.ac.in', name: 'Rohan Kumar', uid: '2021300009', branch: 'EXTC', internshipType: 'Self-Arranged', companyName: 'Tech Mahindra', externalMentorName: 'Kavita Rao', startDate: new Date('2025-01-12'), endDate: new Date('2025-06-12'), salary: 22000, duration: 5, status: 'completed' },
  { email: 'divya.singh@spit.ac.in', name: 'Divya Singh', uid: '2021300010', branch: 'IT', internshipType: 'Off-Campus', companyName: 'HCL', externalMentorName: 'Suresh Menon', startDate: new Date('2025-01-18'), endDate: new Date('2025-04-18'), salary: 17000, duration: 3, status: 'completed' },
  
  // Startups and mid-size
  { email: 'aditya.sharma@spit.ac.in', name: 'Aditya Sharma', uid: '2021300011', branch: 'COMPS', internshipType: 'Off-Campus', companyName: 'Flipkart', externalMentorName: 'Meera Jain', startDate: new Date('2025-02-10'), endDate: new Date('2025-08-10'), salary: 35000, duration: 6, status: 'approved' },
  { email: 'neha.verma@spit.ac.in', name: 'Neha Verma', uid: '2021300012', branch: 'CSE', internshipType: 'Off-Campus', companyName: 'Paytm', externalMentorName: 'Ravi Kapoor', startDate: new Date('2025-01-25'), endDate: new Date('2025-07-25'), salary: 30000, duration: 6, status: 'in-progress' },
  { email: 'vikram.rao@spit.ac.in', name: 'Vikram Rao', uid: '2021300013', branch: 'AIML', internshipType: 'Off-Campus', companyName: 'Ola', externalMentorName: 'Pooja Nambiar', startDate: new Date('2025-02-05'), endDate: new Date('2025-05-05'), salary: 28000, duration: 3, status: 'in-progress' },
  { email: 'pooja.desai@spit.ac.in', name: 'Pooja Desai', uid: '2021300014', branch: 'EXTC', internshipType: 'On-Campus', companyName: 'L&T', externalMentorName: 'Arun Kumar', startDate: new Date('2025-01-15'), endDate: new Date('2025-06-15'), salary: 20000, duration: 5, status: 'approved' },
  { email: 'arjun.pillai@spit.ac.in', name: 'Arjun Pillai', uid: '2021300015', branch: 'MECH', internshipType: 'College-Arranged', companyName: 'Bosch', externalMentorName: 'Sunita Deshmukh', startDate: new Date('2025-02-12'), endDate: new Date('2025-08-12'), salary: 24000, duration: 6, status: 'pending' },
  
  // More diverse entries
  { email: 'sanya.ghosh@spit.ac.in', name: 'Sanya Ghosh', uid: '2021300016', branch: 'IT', internshipType: 'Off-Campus', companyName: 'Cognizant', externalMentorName: 'Dinesh Patel', startDate: new Date('2025-01-22'), endDate: new Date('2025-04-22'), salary: 19000, duration: 3, status: 'completed' },
  { email: 'rahul.bose@spit.ac.in', name: 'Rahul Bose', uid: '2021300017', branch: 'COMPS', internshipType: 'Off-Campus', companyName: 'Adobe', externalMentorName: 'Lakshmi Reddy', startDate: new Date('2025-02-18'), endDate: new Date('2025-08-18'), salary: 55000, duration: 6, status: 'approved' },
  { email: 'kavya.menon@spit.ac.in', name: 'Kavya Menon', uid: '2021300018', branch: 'CSE', internshipType: 'Off-Campus', companyName: 'Samsung', externalMentorName: 'Harish Bhat', startDate: new Date('2025-01-30'), endDate: new Date('2025-07-30'), salary: 40000, duration: 6, status: 'in-progress' },
  { email: 'sameer.khan@spit.ac.in', name: 'Sameer Khan', uid: '2021300019', branch: 'EXTC', internshipType: 'Self-Arranged', companyName: 'Intel', externalMentorName: 'Geeta Iyer', startDate: new Date('2025-02-08'), endDate: new Date('2025-08-08'), salary: 48000, duration: 6, status: 'in-progress' },
  { email: 'ritu.agarwal@spit.ac.in', name: 'Ritu Agarwal', uid: '2021300020', branch: 'MCA', internshipType: 'On-Campus', companyName: 'Capgemini', externalMentorName: 'Naveen Joshi', startDate: new Date('2025-01-16'), endDate: new Date('2025-04-16'), salary: 21000, duration: 3, status: 'completed' },
  
  // Add more for each company to show hiring patterns
  { email: 'ankit.mishra@spit.ac.in', name: 'Ankit Mishra', uid: '2021300021', branch: 'COMPS', internshipType: 'Off-Campus', companyName: 'Google', externalMentorName: 'Rajesh Kumar', startDate: new Date('2025-01-15'), endDate: new Date('2025-07-15'), salary: 72000, duration: 6, status: 'completed' },
  { email: 'priyanka.yadav@spit.ac.in', name: 'Priyanka Yadav', uid: '2021300022', branch: 'IT', internshipType: 'Off-Campus', companyName: 'Microsoft', externalMentorName: 'Priya Sharma', startDate: new Date('2025-01-10'), endDate: new Date('2025-07-10'), salary: 68000, duration: 6, status: 'in-progress' },
  { email: 'vishal.gupta@spit.ac.in', name: 'Vishal Gupta', uid: '2021300023', branch: 'CSE', internshipType: 'Off-Campus', companyName: 'Amazon', externalMentorName: 'Amit Desai', startDate: new Date('2025-02-01'), endDate: new Date('2025-08-01'), salary: 62000, duration: 6, status: 'approved' },
  { email: 'megha.shah@spit.ac.in', name: 'Megha Shah', uid: '2021300024', branch: 'COMPS', internshipType: 'Off-Campus', companyName: 'Meta', externalMentorName: 'Sanjay Verma', startDate: new Date('2025-01-20'), endDate: new Date('2025-07-20'), salary: 65000, duration: 6, status: 'in-progress' },
  { email: 'deepak.rai@spit.ac.in', name: 'Deepak Rai', uid: '2021300025', branch: 'IT', internshipType: 'On-Campus', companyName: 'TCS', externalMentorName: 'Neha Gupta', startDate: new Date('2025-01-05'), endDate: new Date('2025-04-05'), salary: 16000, duration: 3, status: 'completed' },
  
  // TCS multiple hires
  { email: 'swati.kulkarni@spit.ac.in', name: 'Swati Kulkarni', uid: '2021300026', branch: 'EXTC', internshipType: 'On-Campus', companyName: 'TCS', externalMentorName: 'Neha Gupta', startDate: new Date('2025-01-05'), endDate: new Date('2025-04-05'), salary: 15000, duration: 3, status: 'completed' },
  { email: 'nitin.pandey@spit.ac.in', name: 'Nitin Pandey', uid: '2021300027', branch: 'CSE', internshipType: 'On-Campus', companyName: 'TCS', externalMentorName: 'Neha Gupta', startDate: new Date('2025-01-05'), endDate: new Date('2025-04-05'), salary: 14500, duration: 3, status: 'completed' },
  { email: 'shruti.dave@spit.ac.in', name: 'Shruti Dave', uid: '2021300028', branch: 'IT', internshipType: 'On-Campus', companyName: 'TCS', externalMentorName: 'Neha Gupta', startDate: new Date('2025-01-05'), endDate: new Date('2025-04-05'), salary: 15500, duration: 3, status: 'in-progress' },
  { email: 'harsh.tiwari@spit.ac.in', name: 'Harsh Tiwari', uid: '2021300029', branch: 'MCA', internshipType: 'On-Campus', companyName: 'Infosys', externalMentorName: 'Vikram Singh', startDate: new Date('2025-02-15'), endDate: new Date('2025-05-15'), salary: 19000, duration: 3, status: 'approved' },
  { email: 'tanvi.nair@spit.ac.in', name: 'Tanvi Nair', uid: '2021300030', branch: 'COMPS', internshipType: 'Off-Campus', companyName: 'Flipkart', externalMentorName: 'Meera Jain', startDate: new Date('2025-02-10'), endDate: new Date('2025-08-10'), salary: 38000, duration: 6, status: 'in-progress' },
];

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('MongoDB connected');
    
    // Clear existing data
    await Internship.deleteMany({});
    console.log('Cleared existing data');
    
    // Insert sample data
    await Internship.insertMany(sampleData);
    console.log(`✅ Inserted ${sampleData.length} sample internship records with salary data`);
    
    // Show summary
    const totalSalary = sampleData.reduce((sum, s) => sum + s.salary, 0);
    const avgSalary = Math.round(totalSalary / sampleData.length);
    console.log(`\n📊 Summary:`);
    console.log(`   Total Students: ${sampleData.length}`);
    console.log(`   Average Salary: ₹${avgSalary.toLocaleString()}`);
    console.log(`   Highest Salary: ₹${Math.max(...sampleData.map(s => s.salary)).toLocaleString()}`);
    console.log(`   Lowest Salary: ₹${Math.min(...sampleData.map(s => s.salary)).toLocaleString()}`);
    
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });




