import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ProtectedLayout from './components/ProtectedLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import InternshipList from './pages/InternshipList';
import ExcelUpload from './pages/ExcelUpload';
import EvaluationMatrixUpload from './pages/EvaluationMatrixUpload';
import WeeklyReportViewer from './pages/WeeklyReportViewer';
import EvaluationOverview from './pages/EvaluationOverview';
import GroupGenerator from './pages/GroupGenerator';
import StudentPicker from './pages/StudentPicker';
import CompanyAnalytics from './pages/CompanyAnalytics';
import MentorEdit from './pages/MentorEdit';
import AllGroups from './pages/AllGroups';
import AllMentors from './pages/AllMentors';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/internships" element={<InternshipList />} />
          <Route path="/upload" element={<ExcelUpload />} />
          <Route path="/evaluation-upload" element={<EvaluationMatrixUpload />} />
          <Route path="/evaluation-overview" element={<EvaluationOverview />} />
          <Route path="/weekly-reports" element={<WeeklyReportViewer />} />
          <Route path="/groups" element={<GroupGenerator />} />
          <Route path="/all-groups" element={<AllGroups />} />
          <Route path="/all-mentors" element={<AllMentors />} />
          <Route path="/picker" element={<StudentPicker />} />
          <Route path="/analytics" element={<CompanyAnalytics />} />
          <Route path="/mentor-edit" element={<MentorEdit />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
