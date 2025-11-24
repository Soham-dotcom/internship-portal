const mongoose = require('mongoose');
const Internship = require('./models/Internship');
require('dotenv').config();

// Sample data for seeding
const sampleInternships = [
  // COMPS Branch
  {
    student: {
      name: "Rahul Sharma",
      email: "rahul.sharma@student.spit.ac.in",
      phone: "9876543210",
      rollNo: "COMPS001",
      branch: "comps",
      year: "2024",
      avatar: ""
    },
    company: {
      name: "Google",
      location: "Bangalore",
      website: "https://google.com"
    },
    internship: {
      title: "Software Development Intern",
      type: "Technical",
      duration: "3 months",
      startDate: new Date("2024-06-01"),
      endDate: new Date("2024-08-31"),
      stipend: "50000",
      status: "completed"
    },
    mentor: {
      name: "Dr. Anjali Mehta",
      email: "anjali.mehta@spit.ac.in",
      designation: "Professor"
    },
    evaluation: {
      rating: 5,
      feedback: "Outstanding performance. Excellent coding skills.",
      skills: ["React", "Node.js", "MongoDB", "AWS"]
    },
    submittedAt: new Date("2024-05-15")
  },
  {
    student: {
      name: "Priya Patel",
      email: "priya.patel@student.spit.ac.in",
      phone: "9876543211",
      rollNo: "COMPS002",
      branch: "comps",
      year: "2024",
      avatar: ""
    },
    company: {
      name: "Microsoft",
      location: "Hyderabad",
      website: "https://microsoft.com"
    },
    internship: {
      title: "Backend Developer Intern",
      type: "Technical",
      duration: "6 months",
      startDate: new Date("2024-07-01"),
      endDate: new Date("2024-12-31"),
      stipend: "45000",
      status: "in-progress"
    },
    mentor: {
      name: "Prof. Rajesh Kumar",
      email: "rajesh.kumar@spit.ac.in",
      designation: "Associate Professor"
    },
    evaluation: {
      rating: 4,
      feedback: "Good progress so far.",
      skills: ["Python", "Django", "PostgreSQL"]
    },
    submittedAt: new Date("2024-06-20")
  },
  {
    student: {
      name: "Amit Desai",
      email: "amit.desai@student.spit.ac.in",
      phone: "9876543212",
      rollNo: "COMPS003",
      branch: "comps",
      year: "2024",
      avatar: ""
    },
    company: {
      name: "Amazon",
      location: "Mumbai",
      website: "https://amazon.com"
    },
    internship: {
      title: "Full Stack Developer",
      type: "Technical",
      duration: "4 months",
      startDate: new Date("2024-08-01"),
      endDate: new Date("2024-11-30"),
      stipend: "40000",
      status: "approved"
    },
    mentor: {
      name: "Dr. Sneha Joshi",
      email: "sneha.joshi@spit.ac.in",
      designation: "Assistant Professor"
    },
    evaluation: {
      rating: 0,
      feedback: "",
      skills: []
    },
    submittedAt: new Date("2024-07-15")
  },

  // EXTC Branch
  {
    student: {
      name: "Neha Singh",
      email: "neha.singh@student.spit.ac.in",
      phone: "9876543213",
      rollNo: "EXTC001",
      branch: "extc",
      year: "2024",
      avatar: ""
    },
    company: {
      name: "Qualcomm",
      location: "Bangalore",
      website: "https://qualcomm.com"
    },
    internship: {
      title: "VLSI Design Intern",
      type: "Technical",
      duration: "5 months",
      startDate: new Date("2024-06-15"),
      endDate: new Date("2024-11-15"),
      stipend: "35000",
      status: "completed"
    },
    mentor: {
      name: "Prof. Anil Verma",
      email: "anil.verma@spit.ac.in",
      designation: "Professor"
    },
    evaluation: {
      rating: 5,
      feedback: "Excellent work in chip design.",
      skills: ["Verilog", "VLSI", "Cadence", "Circuit Design"]
    },
    submittedAt: new Date("2024-06-01")
  },
  {
    student: {
      name: "Vikram Malhotra",
      email: "vikram.malhotra@student.spit.ac.in",
      phone: "9876543214",
      rollNo: "EXTC002",
      branch: "extc",
      year: "2024",
      avatar: ""
    },
    company: {
      name: "Intel",
      location: "Pune",
      website: "https://intel.com"
    },
    internship: {
      title: "Embedded Systems Intern",
      type: "Technical",
      duration: "3 months",
      startDate: new Date("2024-07-01"),
      endDate: new Date("2024-09-30"),
      stipend: "32000",
      status: "in-progress"
    },
    mentor: {
      name: "Dr. Sunita Rao",
      email: "sunita.rao@spit.ac.in",
      designation: "Associate Professor"
    },
    evaluation: {
      rating: 4,
      feedback: "Good understanding of embedded systems.",
      skills: ["C", "Embedded C", "ARM", "IoT"]
    },
    submittedAt: new Date("2024-06-25")
  },

  // CSE Branch
  {
    student: {
      name: "Arjun Reddy",
      email: "arjun.reddy@student.spit.ac.in",
      phone: "9876543215",
      rollNo: "CSE001",
      branch: "cse",
      year: "2024",
      avatar: ""
    },
    company: {
      name: "Flipkart",
      location: "Bangalore",
      website: "https://flipkart.com"
    },
    internship: {
      title: "Machine Learning Intern",
      type: "Technical",
      duration: "4 months",
      startDate: new Date("2024-06-01"),
      endDate: new Date("2024-09-30"),
      stipend: "38000",
      status: "completed"
    },
    mentor: {
      name: "Prof. Deepak Nair",
      email: "deepak.nair@spit.ac.in",
      designation: "Assistant Professor"
    },
    evaluation: {
      rating: 5,
      feedback: "Exceptional ML skills and research abilities.",
      skills: ["Python", "TensorFlow", "PyTorch", "ML", "Data Science"]
    },
    submittedAt: new Date("2024-05-20")
  },
  {
    student: {
      name: "Kavya Iyer",
      email: "kavya.iyer@student.spit.ac.in",
      phone: "9876543216",
      rollNo: "CSE002",
      branch: "cse",
      year: "2024",
      avatar: ""
    },
    company: {
      name: "TCS",
      location: "Mumbai",
      website: "https://tcs.com"
    },
    internship: {
      title: "Cloud Computing Intern",
      type: "Technical",
      duration: "3 months",
      startDate: new Date("2024-07-15"),
      endDate: new Date("2024-10-15"),
      stipend: "25000",
      status: "in-progress"
    },
    mentor: {
      name: "Dr. Ramesh Kulkarni",
      email: "ramesh.kulkarni@spit.ac.in",
      designation: "Professor"
    },
    evaluation: {
      rating: 4,
      feedback: "Good grasp of cloud technologies.",
      skills: ["AWS", "Azure", "Docker", "Kubernetes"]
    },
    submittedAt: new Date("2024-07-01")
  },

  // MCA Branch
  {
    student: {
      name: "Rohan Gupta",
      email: "rohan.gupta@student.spit.ac.in",
      phone: "9876543217",
      rollNo: "MCA001",
      branch: "mca",
      year: "2024",
      avatar: ""
    },
    company: {
      name: "Infosys",
      location: "Pune",
      website: "https://infosys.com"
    },
    internship: {
      title: "Java Developer Intern",
      type: "Technical",
      duration: "6 months",
      startDate: new Date("2024-06-01"),
      endDate: new Date("2024-11-30"),
      stipend: "28000",
      status: "in-progress"
    },
    mentor: {
      name: "Prof. Meena Sharma",
      email: "meena.sharma@spit.ac.in",
      designation: "Associate Professor"
    },
    evaluation: {
      rating: 4,
      feedback: "Solid Java programming skills.",
      skills: ["Java", "Spring Boot", "Hibernate", "MySQL"]
    },
    submittedAt: new Date("2024-05-25")
  },
  {
    student: {
      name: "Sneha Kapoor",
      email: "sneha.kapoor@student.spit.ac.in",
      phone: "9876543218",
      rollNo: "MCA002",
      branch: "mca",
      year: "2024",
      avatar: ""
    },
    company: {
      name: "Wipro",
      location: "Bangalore",
      website: "https://wipro.com"
    },
    internship: {
      title: "Business Analyst Intern",
      type: "Business",
      duration: "3 months",
      startDate: new Date("2024-08-01"),
      endDate: new Date("2024-10-31"),
      stipend: "22000",
      status: "pending"
    },
    mentor: {
      name: "Dr. Vijay Patil",
      email: "vijay.patil@spit.ac.in",
      designation: "Professor"
    },
    evaluation: {
      rating: 0,
      feedback: "",
      skills: []
    },
    submittedAt: new Date("2024-07-20")
  },

  // AIML Branch
  {
    student: {
      name: "Aditya Chopra",
      email: "aditya.chopra@student.spit.ac.in",
      phone: "9876543219",
      rollNo: "AIML001",
      branch: "aiml",
      year: "2024",
      avatar: ""
    },
    company: {
      name: "NVIDIA",
      location: "Bangalore",
      website: "https://nvidia.com"
    },
    internship: {
      title: "Deep Learning Intern",
      type: "Research",
      duration: "6 months",
      startDate: new Date("2024-06-01"),
      endDate: new Date("2024-11-30"),
      stipend: "55000",
      status: "in-progress"
    },
    mentor: {
      name: "Dr. Priya Bhatt",
      email: "priya.bhatt@spit.ac.in",
      designation: "Professor"
    },
    evaluation: {
      rating: 5,
      feedback: "Outstanding research work in computer vision.",
      skills: ["Python", "TensorFlow", "Computer Vision", "Neural Networks"]
    },
    submittedAt: new Date("2024-05-10")
  },
  {
    student: {
      name: "Ananya Rao",
      email: "ananya.rao@student.spit.ac.in",
      phone: "9876543220",
      rollNo: "AIML002",
      branch: "aiml",
      year: "2024",
      avatar: ""
    },
    company: {
      name: "IBM",
      location: "Mumbai",
      website: "https://ibm.com"
    },
    internship: {
      title: "AI Research Intern",
      type: "Research",
      duration: "4 months",
      startDate: new Date("2024-07-01"),
      endDate: new Date("2024-10-31"),
      stipend: "42000",
      status: "in-progress"
    },
    mentor: {
      name: "Prof. Karthik Menon",
      email: "karthik.menon@spit.ac.in",
      designation: "Associate Professor"
    },
    evaluation: {
      rating: 4,
      feedback: "Excellent research aptitude.",
      skills: ["Python", "NLP", "Machine Learning", "Data Analysis"]
    },
    submittedAt: new Date("2024-06-15")
  },

  // More entries for variety
  {
    student: {
      name: "Siddharth Mehta",
      email: "siddharth.mehta@student.spit.ac.in",
      phone: "9876543221",
      rollNo: "COMPS004",
      branch: "comps",
      year: "2024",
      avatar: ""
    },
    company: {
      name: "Adobe",
      location: "Noida",
      website: "https://adobe.com"
    },
    internship: {
      title: "Frontend Developer Intern",
      type: "Technical",
      duration: "3 months",
      startDate: new Date("2024-09-01"),
      endDate: new Date("2024-11-30"),
      stipend: "38000",
      status: "pending"
    },
    mentor: {
      name: "Dr. Anjali Mehta",
      email: "anjali.mehta@spit.ac.in",
      designation: "Professor"
    },
    evaluation: {
      rating: 0,
      feedback: "",
      skills: []
    },
    submittedAt: new Date("2024-08-20")
  },
  {
    student: {
      name: "Pooja Nambiar",
      email: "pooja.nambiar@student.spit.ac.in",
      phone: "9876543222",
      rollNo: "CSE003",
      branch: "cse",
      year: "2024",
      avatar: ""
    },
    company: {
      name: "Oracle",
      location: "Bangalore",
      website: "https://oracle.com"
    },
    internship: {
      title: "Database Administrator Intern",
      type: "Technical",
      duration: "4 months",
      startDate: new Date("2024-05-15"),
      endDate: new Date("2024-09-15"),
      stipend: "35000",
      status: "completed"
    },
    mentor: {
      name: "Prof. Deepak Nair",
      email: "deepak.nair@spit.ac.in",
      designation: "Assistant Professor"
    },
    evaluation: {
      rating: 5,
      feedback: "Excellent database management skills.",
      skills: ["Oracle", "SQL", "PL/SQL", "Database Design"]
    },
    submittedAt: new Date("2024-05-01")
  },
  {
    student: {
      name: "Karan Joshi",
      email: "karan.joshi@student.spit.ac.in",
      phone: "9876543223",
      rollNo: "EXTC003",
      branch: "extc",
      year: "2024",
      avatar: ""
    },
    company: {
      name: "Samsung",
      location: "Noida",
      website: "https://samsung.com"
    },
    internship: {
      title: "IoT Engineer Intern",
      type: "Technical",
      duration: "3 months",
      startDate: new Date("2024-08-15"),
      endDate: new Date("2024-11-15"),
      stipend: "30000",
      status: "cancelled"
    },
    mentor: {
      name: "Prof. Anil Verma",
      email: "anil.verma@spit.ac.in",
      designation: "Professor"
    },
    evaluation: {
      rating: 0,
      feedback: "Internship cancelled due to personal reasons.",
      skills: []
    },
    submittedAt: new Date("2024-08-01")
  },
  {
    student: {
      name: "Divya Shetty",
      email: "divya.shetty@student.spit.ac.in",
      phone: "9876543224",
      rollNo: "MCA003",
      branch: "mca",
      year: "2024",
      avatar: ""
    },
    company: {
      name: "Accenture",
      location: "Mumbai",
      website: "https://accenture.com"
    },
    internship: {
      title: "Data Analyst Intern",
      type: "Technical",
      duration: "3 months",
      startDate: new Date("2024-06-01"),
      endDate: new Date("2024-08-31"),
      stipend: "26000",
      status: "completed"
    },
    mentor: {
      name: "Prof. Meena Sharma",
      email: "meena.sharma@spit.ac.in",
      designation: "Associate Professor"
    },
    evaluation: {
      rating: 4,
      feedback: "Good analytical and visualization skills.",
      skills: ["Python", "Pandas", "Tableau", "Excel"]
    },
    submittedAt: new Date("2024-05-20")
  },
  {
    student: {
      name: "Harsh Agarwal",
      email: "harsh.agarwal@student.spit.ac.in",
      phone: "9876543225",
      rollNo: "AIML003",
      branch: "aiml",
      year: "2024",
      avatar: ""
    },
    company: {
      name: "Google",
      location: "Bangalore",
      website: "https://google.com"
    },
    internship: {
      title: "Machine Learning Engineer",
      type: "Technical",
      duration: "6 months",
      startDate: new Date("2024-06-01"),
      endDate: new Date("2024-11-30"),
      stipend: "52000",
      status: "in-progress"
    },
    mentor: {
      name: "Dr. Priya Bhatt",
      email: "priya.bhatt@spit.ac.in",
      designation: "Professor"
    },
    evaluation: {
      rating: 5,
      feedback: "Exceptional coding and ML implementation skills.",
      skills: ["Python", "Scikit-learn", "Deep Learning", "Model Deployment"]
    },
    submittedAt: new Date("2024-05-15")
  },
  // Additional entries for more data
  {
    student: {
      name: "Tanvi Deshmukh",
      email: "tanvi.deshmukh@student.spit.ac.in",
      phone: "9876543226",
      rollNo: "COMPS005",
      branch: "comps",
      year: "2024",
      avatar: ""
    },
    company: {
      name: "Salesforce",
      location: "Hyderabad",
      website: "https://salesforce.com"
    },
    internship: {
      title: "Salesforce Developer",
      type: "Technical",
      duration: "4 months",
      startDate: new Date("2024-07-01"),
      endDate: new Date("2024-10-31"),
      stipend: "36000",
      status: "in-progress"
    },
    mentor: {
      name: "Prof. Rajesh Kumar",
      email: "rajesh.kumar@spit.ac.in",
      designation: "Associate Professor"
    },
    evaluation: {
      rating: 4,
      feedback: "Good progress with Salesforce platform.",
      skills: ["Salesforce", "Apex", "Visualforce", "CRM"]
    },
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

    // Clear existing data (optional - comment out if you want to keep existing data)
    await Internship.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Insert sample data
    const result = await Internship.insertMany(sampleInternships);
    console.log(`✅ Successfully added ${result.length} internship records!`);

    // Display summary
    const summary = await Internship.aggregate([
      {
        $group: {
          _id: '$student.branch',
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('\n📊 Data Summary:');
    summary.forEach(item => {
      console.log(`   ${item._id.toUpperCase()}: ${item.count} students`);
    });

    console.log('\n🎉 Database seeded successfully!');
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





