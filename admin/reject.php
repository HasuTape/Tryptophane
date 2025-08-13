<?php
include '../db.php';
$id = intval($_GET['id']);
$conn->query("UPDATE reports SET status='rejected' WHERE id=$id");
// Aktualizacja PN zgłaszającego +1
$res = $conn->query("SELECT reporter_id FROM reports WHERE id=$id");
$uid = $res->fetch_assoc()['reporter_id'];
$conn->query("UPDATE users SET pn = pn + 1 WHERE id=$uid");
header("Location: reports.php");
