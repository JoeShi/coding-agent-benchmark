import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import LeaderboardPage from './LeaderboardPage.jsx'
import './styles.css'

const Page = window.location.pathname === '/leaderboard' ? LeaderboardPage : App

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>,
)
