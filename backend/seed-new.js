const mongoose = require('mongoose');
const Internship = require('./models/Internship');
require('dotenv').config();

// Sample data matching your format
const sampleInternships = [
  {
    email: "aaditya.joglek@student.spit.ac.in",
    name: "Aaditya Ramdas Joglek",
    uid: "2021200044",
    branch: "EXTC",
    internshipType: "Off-Campus",
    companyName: "Pixelwise Technology",
    externalMentorName: "Devashish Patwardhan",
    startDate: new Date("2025-01-01"),
    endDate: new Date("2025-06-30"),
    documentLink: "https://drive.google.com/open?id=1Qs1px7_QP-WM_tblTr9RHDMhCF9R_brd",
    status: "approved",
    stipend: "15000",
    internshipTitle: "Software Development Intern",
    submittedAt: new Date("2024-12-15")
  },
  {
    email: "rahul.sharma@student.spit.ac.in",
    name: "Rahul Sharma",
    uid: "2021300101",
    branch: "COMPS",
    internshipType: "On-Campus",
    companyName: "Google India",
    externalMentorName: "Priya Mehta",
    startDate: new Date("2024-06-01"),
    endDate: new Date("2024-08-31"),
    documentLink: "https://drive.google.com/file/d/abc123",
    status: "completed",
    stipend: "50000",
    companyLocation: "Bangalore",
    internshipTitle: "Software Engineer Intern",
    submittedAt: new Date("2024-05-15")
  },
  {
    email: "priya.patel@student.spit.ac.in",
    name: "Priya Patel",
    uid: "2021300102",
    branch: "COMPS",
    internshipType: "Off-Campus",
    companyName: "Microsoft",
    externalMentorName: "Rajesh Kumar",
    startDate: new Date("2024-07-01"),
    endDate: new Date("2024-12-31"),
    documentLink: "https://drive.google.com/file/d/xyz789",
    status: "in-progress",
    stipend: "45000",
    companyLocation: "Hyderabad",
    internshipTitle: "Backend Developer Intern",
    submittedAt: new Date("2024-06-20")
  },
  {
    email: "amit.desai@student.spit.ac.in",
    name: "Amit Desai",
    uid: "2021300103",
    branch: "COMPS",
    internshipType: "College-Arranged",
    companyName: "Amazon",
    externalMentorName: "Sneha Joshi",
    startDate: new Date("2024-08-01"),
    endDate: new Date("2024-11-30"),
    documentLink: "https://drive.google.com/file/d/def456",
    status: "in-progress",
    stipend: "40000",
    companyLocation: "Mumbai",
    internshipTitle: "Full Stack Developer",
    submittedAt: new Date("2024-07-15")
  },
  {
    email: "neha.singh@student.spit.ac.in",
    name: "Neha Singh",
    uid: "2021200201",
    branch: "EXTC",
    internshipType: "Off-Campus",
    companyName: "Qualcomm",
    externalMentorName: "Anil Verma",
    startDate: new Date("2024-06-15"),
    endDate: new Date("2024-11-15"),
    documentLink: "https://drive.google.com/file/d/ghi789",
    status: "completed",
    stipend: "35000",
    companyLocation: "Bangalore",
    internshipTitle: "VLSI Design Intern",
    submittedAt: new Date("2024-06-01")
  },
  {
    email: "vikram.malhotra@student.spit.ac.in",
    name: "Vikram Malhotra",
    uid: "2021200202",
    branch: "EXTC",
    internshipType: "On-Campus",
    companyName: "Intel Corporation",
    externalMentorName: "Sunita Rao",
    startDate: new Date("2024-07-01"),
    endDate: new Date("2024-09-30"),
    documentLink: "https://drive.google.com/file/d/jkl012",
    status: "completed",
    stipend: "32000",
    companyLocation: "Pune",
    internshipTitle: "Embedded Systems Intern",
    submittedAt: new Date("2024-06-25")
  },
  {
    email: "arjun.reddy@student.spit.ac.in",
    name: "Arjun Reddy",
    uid: "2021400301",
    branch: "CSE",
    internshipType: "Self-Arranged",
    companyName: "Flipkart",
    externalMentorName: "Deepak Nair",
    startDate: new Date("2024-06-01"),
    endDate: new Date("2024-09-30"),
    documentLink: "https://drive.google.com/file/d/mno345",
    status: "completed",
    stipend: "38000",
    companyLocation: "Bangalore",
    internshipTitle: "Machine Learning Intern",
    submittedAt: new Date("2024-05-20")
  },
  {
    email: "kavya.iyer@student.spit.ac.in",
    name: "Kavya Iyer",
    uid: "2021400302",
    branch: "CSE",
    internshipType: "Off-Campus",
    companyName: "TCS Digital",
    externalMentorName: "Ramesh Kulkarni",
    startDate: new Date("2024-07-15"),
    endDate: new Date("2024-10-15"),
    documentLink: "https://drive.google.com/file/d/pqr678",
    status: "in-progress",
    stipend: "25000",
    companyLocation: "Mumbai",
    internshipTitle: "Cloud Computing Intern",
    submittedAt: new Date("2024-07-01")
  },
  {
    email: "rohan.gupta@student.spit.ac.in",
    name: "Rohan Gupta",
    uid: "2021500401",
    branch: "MCA",
    internshipType: "On-Campus",
    companyName: "Infosys",
    externalMentorName: "Meena Sharma",
    startDate: new Date("2024-06-01"),
    endDate: new Date("2024-11-30"),
    documentLink: "https://drive.google.com/file/d/stu901",
    status: "in-progress",
    stipend: "28000",
    companyLocation: "Pune",
    internshipTitle: "Java Developer Intern",
    submittedAt: new Date("2024-05-25")
  },
  {
    email: "sneha.kapoor@student.spit.ac.in",
    name: "Sneha Kapoor",
    uid: "2021500402",
    branch: "MCA",
    internshipType: "College-Arranged",
    companyName: "Wipro Technologies",
    externalMentorName: "Vijay Patil",
    startDate: new Date("2024-08-01"),
    endDate: new Date("2024-10-31"),
    documentLink: "https://drive.google.com/file/d/vwx234",
    status: "pending",
    stipend: "22000",
    companyLocation: "Bangalore",
    internshipTitle: "Business Analyst Intern",
    submittedAt: new Date("2024-07-20")
  },
  {
    email: "aditya.chopra@student.spit.ac.in",
    name: "Aditya Chopra",
    uid: "2021600501",
    branch: "AIML",
    internshipType: "Off-Campus",
    companyName: "NVIDIA",
    externalMentorName: "Priya Bhatt",
    startDate: new Date("2024-06-01"),
    endDate: new Date("2024-11-30"),
    documentLink: "https://drive.google.com/file/d/yza567",
    status: "in-progress",
    stipend: "55000",
    companyLocation: "Bangalore",
    internshipTitle: "Deep Learning Research Intern",
    submittedAt: new Date("2024-05-10")
  },
  {
    email: "ananya.rao@student.spit.ac.in",
    name: "Ananya Rao",
    uid: "2021600502",
    branch: "AIML",
    internshipType: "Self-Arranged",
    companyName: "IBM Research",
    externalMentorName: "Karthik Menon",
    startDate: new Date("2024-07-01"),
    endDate: new Date("2024-10-31"),
    documentLink: "https://drive.google.com/file/d/bcd890",
    status: "in-progress",
    stipend: "42000",
    companyLocation: "Mumbai",
    internshipTitle: "AI Research Intern",
    submittedAt: new Date("2024-06-15")
  },
  {
    email: "siddharth.mehta@student.spit.ac.in",
    name: "Siddharth Mehta",
    uid: "2021300104",
    branch: "COMPS",
    internshipType: "Off-Campus",
    companyName: "Adobe Systems",
    externalMentorName: "Anjali Mehta",
    startDate: new Date("2024-09-01"),
    endDate: new Date("2024-11-30"),
    documentLink: "https://drive.google.com/file/d/efg123",
    status: "pending",
    stipend: "38000",
    companyLocation: "Noida",
    internshipTitle: "Frontend Developer Intern",
    submittedAt: new Date("2024-08-20")
  },
  {
    email: "pooja.nambiar@student.spit.ac.in",
    name: "Pooja Nambiar",
    uid: "2021400303",
    branch: "CSE",
    internshipType: "On-Campus",
    companyName: "Oracle",
    externalMentorName: "Deepak Nair",
    startDate: new Date("2024-05-15"),
    endDate: new Date("2024-09-15"),
    documentLink: "https://drive.google.com/file/d/hij456",
    status: "completed",
    stipend: "35000",
    companyLocation: "Bangalore",
    internshipTitle: "Database Administrator Intern",
    submittedAt: new Date("2024-05-01")
  },
  {
    email: "karan.joshi@student.spit.ac.in",
    name: "Karan Joshi",
    uid: "2021200203",
    branch: "EXTC",
    internshipType: "Off-Campus",
    companyName: "Samsung R&D",
    externalMentorName: "Anil Verma",
    startDate: new Date("2024-08-15"),
    endDate: new Date("2024-11-15"),
    documentLink: "https://drive.google.com/file/d/klm789",
    status: "rejected",
    stipend: "30000",
    companyLocation: "Noida",
    internshipTitle: "IoT Engineer Intern",
    remarks: "Did not meet minimum attendance requirement",
    submittedAt: new Date("2024-08-01")
  },
  {
    email: "divya.shetty@student.spit.ac.in",
    name: "Divya Shetty",
    uid: "2021500403",
    branch: "MCA",
    internshipType: "College-Arranged",
    companyName: "Accenture",
    externalMentorName: "Meena Sharma",
    startDate: new Date("2024-06-01"),
    endDate: new Date("2024-08-31"),
    documentLink: "https://drive.google.com/file/d/nop012",
    status: "completed",
    stipend: "26000",
    companyLocation: "Mumbai",
    internshipTitle: "Data Analyst Intern",
    submittedAt: new Date("2024-05-20")
  },
  {
    email: "harsh.agarwal@student.spit.ac.in",
    name: "Harsh Agarwal",
    uid: "2021600503",
    branch: "AIML",
    internshipType: "Off-Campus",
    companyName: "Google India",
    externalMentorName: "Priya Bhatt",
    startDate: new Date("2024-06-01"),
    endDate: new Date("2024-11-30"),
    documentLink: "https://drive.google.com/file/d/qrs345",
    status: "in-progress",
    stipend: "52000",
    companyLocation: "Bangalore",
    internshipTitle: "ML Engineer Intern",
    submittedAt: new Date("2024-05-15")
  },
  {
    email: "tanvi.deshmukh@student.spit.ac.in",
    name: "Tanvi Deshmukh",
    uid: "2021300105",
    branch: "COMPS",
    internshipType: "Self-Arranged",
    companyName: "Salesforce",
    externalMentorName: "Rajesh Kumar",
    startDate: new Date("2024-07-01"),
    endDate: new Date("2024-10-31"),
    documentLink: "https://drive.google.com/file/d/tuv678",
    status: "in-progress",
    stipend: "36000",
    companyLocation: "Hyderabad",
    internshipTitle: "Salesforce Developer",
    submittedAt: new Date("2024-06-20")
  }
];

// Connect to MongoDB and seed data
const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/spit-internships';
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await Internship.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Insert sample data
    const result = await Internship.insertMany(sampleInternships);
    console.log(`✅ Successfully added ${result.length} internship records!`);

    // Display summary
    const branchSummary = await Internship.aggregate([
      {
        $group: {
          _id: '$branch',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const typeSummary = await Internship.aggregate([
      {
        $group: {
          _id: '$internshipType',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusSummary = await Internship.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('\n📊 Data Summary:');
    console.log('\n  Branch-wise:');
    branchSummary.forEach(item => {
      console.log(`   ${item._id}: ${item.count} students`);
    });

    console.log('\n  Internship Type:');
    typeSummary.forEach(item => {
      console.log(`   ${item._id}: ${item.count} students`);
    });

    console.log('\n  Status:');
    statusSummary.forEach(item => {
      console.log(`   ${item._id}: ${item.count} students`);
    });

    console.log('\n🎉 Database seeded successfully with your format!');
    console.log('🚀 You can now access the portal and see all features in action!\n');

    // Close connection
    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    mongoose.connection.close();
    process.exit(1);
  }
};

// Run the seed function
seedDatabase();





