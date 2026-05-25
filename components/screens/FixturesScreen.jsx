'use client';

import { useState } from 'react';
import MatchesScreen from './MatchesScreen';
import BracketScreen from './BracketScreen';

export default function FixturesScreen({ matches, onBet, bets, onCancelBet, poolMap, allUsers }) {
  const [view, setView] = useState('matches');

  return (
    <div>
      <div className="material-tabs">
        <button
          className={'material-tab' + (view === 'matches' ? ' active' : '')}
          onClick={() => setView('matches')}
        >
          Matches
        </button>
        <button
          className={'material-tab' + (view === 'bracket' ? ' active' : '')}
          onClick={() => setView('bracket')}
        >
          Bracket
        </button>
      </div>

      {view === 'matches'
        ? <MatchesScreen matches={matches} onBet={onBet} bets={bets} onCancelBet={onCancelBet} poolMap={poolMap} allUsers={allUsers} />
        : <BracketScreen matches={matches} />
      }
    </div>
  );
}
