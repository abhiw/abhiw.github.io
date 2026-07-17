---
author: Abhijeet Warhekar
pubDatetime: 2026-03-15T00:00:00Z
title: Raft Consensus Algorithm
slug: raft-consensus-algorithm
featured: false
draft: false
tags:
  - distributed systems
  - raft
  - consensus
description: A deep dive into the Raft consensus algorithm — leader election, log replication, safety, membership changes, and log compaction.
---

## The Problem with Distributed Consensus

Large scale software systems need a collection of machines to work together as coherent group. Most of the software we interact with today is built using these kinds of fault-tolerant coherent groups named as "distributed systems". The machines in distributed system are connected with each other over a network and work together as a cohesive system.

Consensus in distributed systems is essential for ensuring majority of nodes agree on a single, consistent shared state or value. Consider a simple write operation: a client sends a value to one node, but before that node can inform the others, it crashes. Now different nodes hold different values with no way to agree on which one is correct. This is the fundamental problem consensus algorithms exist to solve.

A consensus algorithm must ensure several things simultaneously. All nodes must see the same data and prevent conflicting updates from being applied in different orders. The system must continue operating despite node crashes or network failures, not just when everything is working perfectly. And all nodes must process transactions in the same order regardless of when they arrive, because the same operations applied in different orders can produce entirely different outcomes. Finally, nodes must agree on which single node is the leader responsible for handling writes, because allowing multiple nodes to accept writes simultaneously leads to the "split-brain" problem where the cluster irreparably diverges.

Popular consensus algorithms include Paxos, Raft, Viewstamped Replication. All these algorithms provides solutions for some or all of the above mentioned problems. Paxos and variations of Paxos like Multi-Paxos have been used in practice for a long time now despite its complexity.

## Raft's design philosophy

Understandability is one of the major goals of the Raft algorithm.

```
...
we wanted the algorithm to facilitate the development of intuitions
that are essential for system builders. It was important not
just for the algorithmto work, but for it to be obviouswhy
it works.
...
```

This snippet from the Raft paper summarises the philosophy behind Raft algorithm design.
To achieve this, the consensus algorithm is divided in 3 different subproblems:

- Leader election
- Log replication
- Safety

Raft solves these three problems separately to achieve an understandable and practical algorithm. It reduces nondeterminism through a set of design choices. Raft includes strong leadership which allows flow of logs from leader to followers only. This results in strong consistency. Randomised election timer provide simple and effective conflict resolution when multiple nodes are competing. Use of joint consensus to manage membership changes allows replacing nodes without any downtime.

## Leader election

Raft algorithm divides the available node in 3 different types:

- Leader: Accepts and replicates log entries
- Follower: Stores the log entries received from leader in the same order. Redirects requests to leader.
- Candidate: Proposes a vote and votes itself as next leader.

There should always be at most one leader ready to accept the requests. In case of absence of leader or end of term for a leader, a follower node becomes a candidate and starts a vote.
To achieve this Raft defines RPCs which allows a follower to start a vote and replicate entries to other followers.

- RequestVote - Invoked by candidates to gather votes from other nodes

```
RequestVote(term, candidateId, lastLogIndex, lastLogTerm)
  returns (currentTerm, voteGranted)

  // Step 1: Stale candidate check
  if term < currentTerm
    return (currentTerm, false)

  // Step 2: Vote eligibility check
  alreadyVotedForCandidate = (votedFor == null OR votedFor == candidateId)

  candidateLogUpToDate =
    lastLogTerm > log.last().term
    OR (lastLogTerm == log.last().term AND lastLogIndex >= log.lastIndex())

  if alreadyVotedForCandidate AND candidateLogUpToDate
    votedFor = candidateId
    return (currentTerm, true)

  return (currentTerm, false)
```

- AppendEntries - Invoked by leader for log replication

```
AppendEntries(term, leaderId, prevLogIndex, prevLogTerm, entries[], leaderCommit)
  returns (currentTerm, success)

  // Step 1: Stale leader check
  if term < currentTerm
    return (currentTerm, false)

  // Step 2: Log consistency check
  if log[prevLogIndex] does not exist
    OR log[prevLogIndex].term ≠ prevLogTerm
    return (currentTerm, false)

  // Step 3: Conflict resolution
  for i = 0 to entries.length - 1
    logIndex = prevLogIndex + 1 + i
    if log[logIndex] exists AND log[logIndex].term != entries[i].term
      truncate log from logIndex onward   // delete conflicting entry + all after it
      break

  // Step 4: Append new entries
  for each entry in entries[] not already in log
    append entry to log

  // Step 5: Advance commit index
  if leaderCommit > commitIndex
    commitIndex = min(leaderCommit, index of last new entry)

  return (currentTerm, true)
```

Time is divided in terms and each term begins with an election. We can consider term as a logical clock. This logical clock increases monotonically.

RequestVote() step2 ensures that a node votes for at most one candidate. A candidate votes for itself and then requests vote from other nodes. It may happen that many followers become candidates in the same term. In this case, no leader may get elected because of lack of majority. This results in start of new election after the candidate time out. This timeout is randomised.

Leader also needs to keep sending heartbeat signal to followers to let them know that leader is healthy. AppendEntries() with log entries is used in this case to prevent followers from starting election before end of term.

## How agreements actually happen

Leader node uses AppendEntries() to replicate the entries to follower nodes in parallel. The leader appends the entry to its log first and appends the entry to its state machine only after replicating the entry. In case of slow follower or any network failure, leader keeps retrying till follower eventually stores all log entries. A log entry is considered committed once it has been replicated on majority of nodes.

Raft also handles consistency issues in follower. Follower may not have all the previous entries or it may conflicting entries. To achieve consistency, the log entries in follower are always overwritten with entries from leader. If the followers logs are inconsistent with leaders logs, AppendEntries() keeps rejecting the update. The leader makes the calls with decremented values of nextIndex till it matches with the follower. The conflicting entries are also removed as part of this operation.

## Safety

The algorithm enforces that a node can be elected as a leader only if it has all the previous entries. This ensures only one way flow of logs from leader to followers and never the other way around. This is guaranteed through log matching property and strong leader property.

To understand these properties, consider a case of a cluster with 5 nodes. A leader S1 has replicated an entry AE to 3 of the nodes which is a required majority for replication commit. The leader then crashes before replicating the entry to 2 other nodes. A new leader S5 may get selected from the two nodes which do not have the latest entry AE. This new leader S5 could overwrite the AE with new entry RV. This violates the consistency guarantees. The voting eligibility condition prevents this precise case in RequestVote(). The nodes with older entries cannot become leader.

There is an edge case here in which leader S1 crashed before committing the entry after replicating it to majority of the nodes (3 nodes). A node S3 with latest entry becomes leader and discovers that an entry is replicated to majority of the nodes and commits it. The remaining 2 nodes never received the entry AE.

To prevent this, Raft never allows committing entries from previous term by counting replicas. Only current term entries are committed by counting replicas. The log matching property indirectly makes sure that all previous entries are also committed. To prevent this, Raft never allows a leader to commit entry from previous term. It can only commit entries from current term. Once the current term entry is committed, log matching property takes case of committing the previous entries implicitly.

![Raft safety: scenario where vote eligibility prevents a stale node from becoming leader](/assets/blog/raft/Pasted%20image%2020260315000631.png)

## Membership changes

Configuration here means replacing the servers in cluster or changing the degree of replication. Taking the entire cluster offline is not feasible here.

Consider a simple example: a three node cluster transitioning to a five node cluster. At some point during the transition, the three old nodes might form a majority among themselves and elect a leader, while the five new nodes simultaneously form their own majority and elect a different leader. The cluster now has two leaders accepting writes, which is precisely the split-brain problem Raft is designed to prevent.

Raft uses two phase approach for managing configuration changes. Whenever the configuration changes, the cluster transitions to intermediate state of joint consensus. Any node that receives this entry immediately starts operating under joint consensus rules, it does not wait for the entry to be committed. Once the joint consensus entry is committed, meaning a majority of both old and new nodes have it, the leader appends the new configuration as another log entry. Once that entry is committed, the cluster is fully on the new configuration and joint consensus is over.

To prevent a slow new node from stalling the cluster during this catch-up period, Raft adds new servers as non-voting members initially. The leader replicates entries to them but does not count them toward commit majority until they are sufficiently caught up. Only then does the formal joint consensus phase begin.

The leader itself might not be part of the new configuration. In this case the leader continues to manage the transition replicating both the joint consensus entry and the new configuration entry but steps down once the new configuration is committed. During this period it does not count itself toward majority, since it is no longer a member of the cluster it is managing.

## Log compaction

In practical system, entries can go indefinitely resulting in availability issues. Raft uses snapshots to solve this problem. The current system state is written on stable storage and all the entries upto that point are discarded. Followers which are left behind are sent snapshots by leader.
Followers can also take their independent snapshots. The leader has no knowledge of these. As consensus has already reached when snapshotting, this lack of knowledge does not create any conflict. The decisions still flow from leader to followers.

![Raft log compaction: snapshotting current state and discarding committed log entries](/assets/blog/raft/Pasted%20image%2020260314170550.png)

Leader uses InstallSnapshot() RPC to send chunks of snapshots to followers.

```
InstallSnapshot(term, leaderId, lastIncludedIndex, lastIncludedTerm, offset, data[], done)
  returns (currentTerm)

  // Step 1: Stale leader check
  if term < currentTerm
    return (currentTerm)

  // Step 2: Create snapshot file if this is the first chunk
  if offset == 0
    createNewSnapshotFile()

  // Step 3: Write chunk to snapshot file at given offset
  writeToSnapshotFile(offset, data)

  // Step 4: Wait for remaining chunks if not done
  if done == false
    return (currentTerm)

  // Step 5: Persist snapshot, discard any older partial or complete snapshot
  if existingSnapshot.lastIncludedIndex < lastIncludedIndex
    replaceSnapshotWith(currentSnapshotFile)

  // Step 6: Check if log already contains the snapshot's last included entry
  if log[lastIncludedIndex] exists AND log[lastIncludedIndex].term == lastIncludedTerm
    // Retain all log entries after lastIncludedIndex, they are still valid
    truncateLogBefore(lastIncludedIndex)
    return (currentTerm)

  // Step 7: Snapshot covers entries not in our log — discard entire log
  clearLog()

  // Step 8: Reset state machine and load cluster configuration from snapshot
  resetStateMachine(snapshotContents)
  loadClusterConfiguration(snapshotContents.configuration)

  return (currentTerm)
```

## Conclusion

Raft is often described as the understandable consensus algorithm, but understandable does not mean simple. The subtleties in the Safety section alone — why you cannot commit old term entries by replica count, why the vote eligibility check is the precise mechanism that enforces Leader Completeness — reveal how much careful thinking went into what looks like a clean design on the surface. Reading the original paper by Ongaro and Ousterhout is worth your time if you want the full formal treatment. What this post has tried to do is build the intuition that makes that formalism feel inevitable rather than arbitrary.

## References

1. [In Search of an Understandable Consensus Algorithm (Extended Version)](https://raft.github.io/raft.pdf)
2. [The Secret Lives of Data](https://thesecretlivesofdata.com/raft/)
3. [Paxos Made Simple](https://lamport.azurewebsites.net/pubs/paxos-simple.pdf)
