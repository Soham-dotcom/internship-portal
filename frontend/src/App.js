import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import InternshipList from './pages/InternshipList';
import ExcelUpload from './pages/ExcelUpload';
import GroupGenerator from './pages/GroupGenerator';
import StudentPicker from './pages/StudentPicker';
import CompanyAnalytics from './pages/CompanyAnalytics';
import MentorEdit from './pages/MentorEdit';
import AllGroups from './pages/AllGroups';
import AllMentors from './pages/AllMentors';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/internships" element={<InternshipList />} />
          <Route path="/upload" element={<ExcelUpload />} />
          <Route path="/groups" element={<GroupGenerator />} />
          <Route path="/all-groups" element={<AllGroups />} />
          <Route path="/all-mentors" element={<AllMentors />} />
          <Route path="/picker" element={<StudentPicker />} />
          <Route path="/analytics" element={<CompanyAnalytics />} />
          <Route path="/mentor-edit" element={<MentorEdit />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
