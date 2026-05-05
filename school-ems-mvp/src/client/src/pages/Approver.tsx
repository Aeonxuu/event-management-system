import React, { useEffect, useState } from 'react'
import axios from 'axios'

export default function Approver(){
  const [queue, setQueue] = useState<any[]>([])

  useEffect(()=>{
    axios.get('/api/queues/me').then(r=>setQueue(r.data.data.queue || []))
  },[])

  return (
    <div style={{padding:20}}>
      <h2>Approver - Queue</h2>
      <ul>
        {queue.map(e=> <li key={e._id}>{e.title} - {e.status}</li>)}
      </ul>
    </div>
  )
}
