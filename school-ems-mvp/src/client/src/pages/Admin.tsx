import React, { useEffect, useState } from 'react'
import axios from 'axios'

export default function Admin(){
  const [items, setItems] = useState<any[]>([])

  useEffect(()=>{
    axios.get('/api/admin/events?page=1&limit=10').then(r=>setItems(r.data.data.items || []))
  },[])

  return (
    <div style={{padding:20}}>
      <h2>Admin - Events</h2>
      <ul>
        {items.map((e:any)=> <li key={e._id}>{e.title} - {e.status}</li>)}
      </ul>
    </div>
  )
}
