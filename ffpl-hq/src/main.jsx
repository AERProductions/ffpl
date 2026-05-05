import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { LeaderboardPage } from './pages/LeaderboardPage.jsx'
import { HangarPage } from './pages/HangarPage.jsx'
import { CalendarPage } from './pages/CalendarPage.jsx'
import { ProfilePage } from './pages/ProfilePage.jsx'
import { CommissionerPage } from './pages/CommissionerPage.jsx'
import { AdminPage } from './pages/AdminPage.jsx'

const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <LeaderboardPage /> },
      { path: 'hangar', element: <HangarPage /> },
      { path: 'calendar', element: <CalendarPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'commissioner', element: <CommissionerPage /> },
      { path: 'admin', element: <AdminPage /> },
    ],
  },
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
