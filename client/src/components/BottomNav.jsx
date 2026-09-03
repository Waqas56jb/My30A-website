import { NavLink } from 'react-router-dom'
import { Car, Wallet } from 'lucide-react'

export default function BottomNav() {
  return (
    <nav className="nav" aria-label="Driver">
      <NavLink to="/driver" end>
        <Car size={22} strokeWidth={1.85} />
        Trips
      </NavLink>
      <NavLink to="/driver/earnings">
        <Wallet size={22} strokeWidth={1.85} />
        Earnings
      </NavLink>
    </nav>
  )
}
