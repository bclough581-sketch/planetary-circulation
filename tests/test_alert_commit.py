"""Offline alert regressions; no real ntfy topic or notification is used."""
import contextlib
import io
import os
from pathlib import Path
import re
import unittest
from unittest.mock import patch, mock_open
import alert

class CommitAlerts(unittest.TestCase):
    def test_push_failure_is_reported_when_prior_steps_succeed(self):
        env = dict(TESTS="success", FETCH="success", CHECK="success", COMMIT="failure")
        self.assertEqual(alert.problems({}, {}, env), ["data commit/push failed"])

    def test_success_and_skipped_commit_are_quiet(self):
        for outcome in ("success", "skipped", ""):
            with self.subTest(outcome=outcome):
                self.assertEqual(alert.problems({}, {}, dict(COMMIT=outcome)), [])

    def run_main(self, topic):
        with patch("builtins.open", mock_open(read_data="{}")), patch.dict(os.environ, dict(NTFY_TOPIC=topic, TESTS="success", FETCH="success", CHECK="success", COMMIT="failure"), clear=True), patch.object(alert.urllib.request, "urlopen") as send, contextlib.redirect_stdout(io.StringIO()) as output:
            alert.main()
            return send, output.getvalue()

    def test_main_builds_notification_for_push_failure_without_real_network(self):
        send, output = self.run_main("synthetic-test-only")
        send.assert_called_once()
        request = send.call_args.args[0]
        self.assertEqual(request.full_url, "https://ntfy.sh/synthetic-test-only")
        self.assertEqual(request.data, b"Amalgam data job: data commit/push failed")
        self.assertIn("alert: sent", output)

    def test_missing_topic_logs_failure_but_does_not_send(self):
        send, output = self.run_main("")
        send.assert_not_called()
        self.assertIn("data commit/push failed", output)
        self.assertIn("no phone alert was sent", output)

    def test_workflow_passes_real_commit_step_outcome_to_always_alert(self):
        text = (Path(alert.HERE)/".github/workflows/refresh.yml").read_text(encoding="utf8")
        commit, notification = text.split("      - name: Commit if changed\n", 1)[1].split("      - name: Phone alert if something needs a look\n", 1)
        found = re.search(r"^        id: ([a-zA-Z0-9_-]+)$", commit, re.M)
        self.assertIsNotNone(found, "commit/push step must expose an outcome")
        self.assertIn("COMMIT: ${{ steps." + found.group(1) + ".outcome }}", notification)
        self.assertIn("if: always()", notification)
