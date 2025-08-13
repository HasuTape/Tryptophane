<?php
include '../db.php';
include '../jwt.php';
if (!isset($_COOKIE['token']) || !($user_id = verify_jwt($_COOKIE['token']))) die("Brak autoryzacji");
$video_id = intval($_POST['id']);
$conn->query("UPDATE users SET pw = pw + 1 WHERE id=$user_id");
header("Location: view.php?id=$video_id");
