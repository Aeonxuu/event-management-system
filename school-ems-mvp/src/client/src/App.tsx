import React from 'react'
import { Routes, Route, Link, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Student from './pages/Student'
import Approver from './pages/Approver'
import Admin from './pages/Admin'

export default function App() {
  return (
    <div>
      <nav>
        <Link to="/">Home</Link> | <Link to="/student">Student</Link> | <Link to="/approver">Approver</Link> | <Link to="/admin">Admin</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/student" element={<Student />} />
        <Route path="/approver" element={<Approver />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </div>
  )
}
