import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Vision from './pages/Vision'
import Connect from './pages/Connect'

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/vision" element={<Vision />} />
        <Route path="/connect" element={<Connect />} />
      </Routes>
      <Footer />
    </>
  )
}
