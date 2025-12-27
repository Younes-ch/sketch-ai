export interface VoteKick {
  targetUsername: string;
  initiatorUsername: string;
  votesToKick: number;
  votesToKeep: number;
  totalVotersNeeded: number;
}

export interface VoteKickResult {
  targetUsername: string;
  shouldKick: boolean;
  votesToKick: number;
  votesToKeep: number;
}
