import React, { useEffect, useState } from 'react'
import axios from 'axios'

export default function Student(){
  const [events, setEvents] = useState<any[]>([])

  useEffect(()=>{
    axios.get('/api/events').then(r=>setEvents(r.data.data.events || []))
  },[])

  return (
    <div style={{padding:20}}>
      <h2>Student - My Events</h2>
      <ul>
        {events.map(e=> <li key={e._id}>{e.title} - {e.status}</li>)}
      </ul>
    </div>
  )
}
