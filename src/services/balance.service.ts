import { MemberBalance, DebtTransfer } from '../types/index.js';

interface RawMember {
  user_id: string;
  profiles?: {
    full_name: string | null;
    email: string;
  };
}

interface RawExpense {
  id: string;
  paid_by: string;
  amount: number;
  currency: string;
  expense_splits: {
    user_id: string;
    amount: number;
  }[];
}

interface RawSettlement {
  payer_id: string;
  receiver_id: string;
  amount: number;
}

export class BalanceService {
  /**
   * Calculates net balances and optimal transfers to settle all group debts.
   */
  static calculateBalances(
    members: RawMember[],
    expenses: RawExpense[],
    settlements: RawSettlement[],
    currency: string = 'EUR'
  ): { balances: MemberBalance[]; suggestedTransfers: DebtTransfer[] } {
    const memberMap = new Map<
      string,
      {
        name: string;
        email: string;
        totalPaid: number;
        totalOwed: number;
        settledPaid: number;
        settledReceived: number;
      }
    >();

    // 1. Initialize map for each group member
    for (const m of members) {
      memberMap.set(m.user_id, {
        name: m.profiles?.full_name || m.profiles?.email || 'Membro',
        email: m.profiles?.email || '',
        totalPaid: 0,
        totalOwed: 0,
        settledPaid: 0,
        settledReceived: 0,
      });
    }

    // 2. Accumulate expenses & splits
    for (const exp of expenses) {
      const payer = memberMap.get(exp.paid_by);
      if (payer) {
        payer.totalPaid += Number(exp.amount);
      }

      if (exp.expense_splits) {
        for (const split of exp.expense_splits) {
          const debtor = memberMap.get(split.user_id);
          if (debtor) {
            debtor.totalOwed += Number(split.amount);
          }
        }
      }
    }

    // 3. Accumulate settlements already paid
    for (const s of settlements) {
      const payer = memberMap.get(s.payer_id);
      if (payer) {
        payer.settledPaid += Number(s.amount);
      }

      const receiver = memberMap.get(s.receiver_id);
      if (receiver) {
        receiver.settledReceived += Number(s.amount);
      }
    }

    // 4. Calculate net balance for each member
    const balances: MemberBalance[] = [];
    const debtors: { id: string; name: string; amount: number }[] = [];
    const creditors: { id: string; name: string; amount: number }[] = [];

    memberMap.forEach((data, userId) => {
      // Net balance = (what I paid out + what I settled) - (what I owe + what I already received as refund)
      const rawNet =
        data.totalPaid + data.settledPaid - (data.totalOwed + data.settledReceived);
      const netBalance = Math.round(rawNet * 100) / 100;

      balances.push({
        user_id: userId,
        user_name: data.name,
        user_email: data.email,
        total_paid: Math.round(data.totalPaid * 100) / 100,
        total_owed: Math.round(data.totalOwed * 100) / 100,
        net_balance: netBalance,
      });

      if (netBalance < -0.01) {
        debtors.push({ id: userId, name: data.name, amount: Math.abs(netBalance) });
      } else if (netBalance > 0.01) {
        creditors.push({ id: userId, name: data.name, amount: netBalance });
      }
    });

    // 5. Debt Simplification Algorithm (greedy match of debtors to creditors)
    const suggestedTransfers: DebtTransfer[] = [];

    let dIdx = 0;
    let cIdx = 0;

    // Work with cents to avoid floating point issues
    const debtorsWork = debtors.map((d) => ({ ...d, amount: Math.round(d.amount * 100) }));
    const creditorsWork = creditors.map((c) => ({ ...c, amount: Math.round(c.amount * 100) }));

    while (dIdx < debtorsWork.length && cIdx < creditorsWork.length) {
      const debtor = debtorsWork[dIdx];
      const creditor = creditorsWork[cIdx];

      if (!debtor || !creditor) break;

      const settlementCents = Math.min(debtor.amount, creditor.amount);

      if (settlementCents > 0) {
        suggestedTransfers.push({
          from_user_id: debtor.id,
          from_user_name: debtor.name,
          to_user_id: creditor.id,
          to_user_name: creditor.name,
          amount: settlementCents / 100,
          currency,
        });

        debtor.amount -= settlementCents;
        creditor.amount -= settlementCents;
      }

      if (debtor.amount === 0) dIdx++;
      if (creditor.amount === 0) cIdx++;
    }

    return { balances, suggestedTransfers };
  }
}

