<?php
include '../db.php';
$id = intval($_GET['id']);
$conn->query("UPDATE reports SET status='confirmed' WHERE id=$id");
// Aktualizacja PW zgłaszającego +1
$res = $conn->query("SELECT reporter_id FROM reports WHERE id=$id");
$uid = $res->fetch_assoc()['reporter_id'];
$conn->query("UPDATE users SET pw = pw + 1 WHERE id=$uid");
header("Location: reports.php");
