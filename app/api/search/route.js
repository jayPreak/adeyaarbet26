import { MATCHES, TEAM, VENUE, FRIENDS } from '@/lib/data';
import supabase from '@/lib/supabase';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim().toLowerCase();

  if (q.length < 2) {
    return Response.json({ matches: [], users: [] });
  }

  // Search matches by team name, team code, group, or venue
  const matchResults = MATCHES.filter(m => {
    const home = TEAM[m.home];
    const away = TEAM[m.away];
    const venue = (m.venue || '').toLowerCase();
    const group = m.group ? `group ${m.group}`.toLowerCase() : '';
    return (
      home?.name.toLowerCase().includes(q) ||
      home?.code.toLowerCase().includes(q) ||
      away?.name.toLowerCase().includes(q) ||
      away?.code.toLowerCase().includes(q) ||
      venue.includes(q) ||
      group.includes(q)
    );
  }).slice(0, 10);

  // Search users/friends by name or id
  const userResults = FRIENDS.filter(f =>
    f.name.toLowerCase().includes(q) || f.id.toLowerCase().includes(q)
  ).map(f => ({
    id: f.id,
    display_name: f.name,
    username: f.id,
  }));

  let scheduleMap = {};
  if (supabase && matchResults.length) {
    const { data } = await supabase
      .from('match_schedule')
      .select('id, kickoff_ts')
      .in('id', matchResults.map(m => m.id));
    for (const row of data || []) scheduleMap[row.id] = row.kickoff_ts;
  }
  const matchResultsWithDate = matchResults.map(m => ({
    ...m,
    date: scheduleMap[m.id] ? new Date(scheduleMap[m.id]).toISOString().slice(0, 10) : null,
  }));

  return Response.json({ matches: matchResultsWithDate, users: userResults });
}
