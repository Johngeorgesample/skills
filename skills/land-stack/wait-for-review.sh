#!/bin/bash
# Usage: wait-for-review.sh <owner/repo> <pr> <since_iso8601> [max_hours]
# Polls every 5 minutes until the PR is approved, gets human review feedback (a review, inline
# comment, or conversation comment) after <since>, or is merged/closed. max_hours=0 checks once.
# Prints one status line: APPROVED | FEEDBACK <count> | MERGED | CLOSED | NONE | TIMEOUT.
set -u
repo=$1; n=$2; since=$3; max_hours=${4:-24}
me=$(gh api user -q .login)
human="select(.user.type != \"Bot\" and .user.login != \"$me\")"
bare_approval='select(.state != "APPROVED" or (.body // "") != "")'

count_new() {
  gh api "$1" --paginate -q "[.[] | $human | select((.$2 // \"\") > \"$since\") | ${3:-.}] | length" \
    | awk '{ s += $1 } END { print s + 0 }'
}

checks=$((max_hours * 12)); [ "$checks" -lt 1 ] && checks=1
for i in $(seq 1 "$checks"); do
  read -r state decision < <(gh pr view "$n" -R "$repo" --json state,reviewDecision -q '"\(.state) \(.reviewDecision)"')
  case "$state" in
    MERGED|CLOSED) echo "$state"; exit 0 ;;
  esac
  feedback=$(( $(count_new "repos/$repo/issues/$n/comments" created_at) \
    + $(count_new "repos/$repo/pulls/$n/comments" created_at) \
    + $(count_new "repos/$repo/pulls/$n/reviews" submitted_at "$bare_approval") ))
  if [ "$feedback" -gt 0 ]; then echo "FEEDBACK $feedback"; exit 0; fi
  if [ "$decision" = APPROVED ]; then echo APPROVED; exit 0; fi
  [ "$i" -lt "$checks" ] && sleep 300
done
if [ "$max_hours" = 0 ]; then echo NONE; else echo TIMEOUT; fi
