export function computeNetPositions(profiles) {
  return profiles.map(p => ({
    id: p.id,
    name: p.display_name || p.username,
    net: p.balance,
  }));
}

// Normalize positions to zero-sum: parimutuel rounding can create a small
// surplus (more paid out than collected). Distribute any imbalance
// proportionally among creditors so display "net win/loss" and "settlement
// plan transactions" agree on every user's number.
export function normalizeToZeroSum(positions) {
  const people = positions.filter(p => p.net !== 0).map(p => ({ ...p }));
  const totalCredit = people.filter(p => p.net > 0).reduce((s, p) => s + p.net, 0);
  const totalDebit = people.filter(p => p.net < 0).reduce((s, p) => s + p.net, 0);
  const surplus = totalCredit + totalDebit;

  if (surplus > 0 && totalCredit > 0) {
    const creditors = people.filter(p => p.net > 0);
    let remaining = surplus;
    for (let i = 0; i < creditors.length && remaining > 0; i++) {
      const cut = i === creditors.length - 1 ? remaining : Math.round((creditors[i].net / totalCredit) * surplus);
      creditors[i].net -= Math.min(cut, remaining);
      remaining -= cut;
    }
  } else if (surplus < 0 && totalDebit < 0) {
    // House shortfall: trim debtors proportionally so plan can zero out.
    const debtors = people.filter(p => p.net < 0);
    let remaining = -surplus;
    for (let i = 0; i < debtors.length && remaining > 0; i++) {
      const cut = i === debtors.length - 1 ? remaining : Math.round((debtors[i].net / totalDebit) * (-surplus));
      debtors[i].net += Math.min(cut, remaining);
      remaining -= cut;
    }
  }

  return people;
}

// Greedy min-transactions: pair largest creditor with largest debtor each round.
// Returns [{from: {id, name}, to: {id, name}, amount}]
export function computeSettlement(profiles) {
  const people = normalizeToZeroSum(computeNetPositions(profiles));

  const creditors = people.filter(p => p.net > 0).sort((a, b) => b.net - a.net);
  const debtors   = people.filter(p => p.net < 0).sort((a, b) => a.net - b.net);

  const transactions = [];
  let i = 0, j = 0;

  while (i < creditors.length && j < debtors.length) {
    const credit = creditors[i];
    const debt   = debtors[j];
    const amount = Math.min(credit.net, -debt.net);

    if (amount > 0) {
      transactions.push({
        from:   { id: debt.id,   name: debt.name   },
        to:     { id: credit.id, name: credit.name },
        amount,
      });
    }

    credit.net -= amount;
    debt.net   += amount;

    if (credit.net === 0) i++;
    if (debt.net   === 0) j++;
  }

  return transactions;
}
