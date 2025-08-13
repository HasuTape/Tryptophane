<?php
include '../db.php';
include '../jwt.php';
if (!isset($_COOKIE['token']) || !($user_id = verify_jwt($_COOKIE['token']))) die("Brak autoryzacji");
$video_id = intval($_POST['id']);
// Waga = PW + 1
$res = $conn->query("SELECT pw FROM users WHERE id=$user_id");
$row = $res->fetch_assoc();
$weight = $row['pw'] + 1;
$conn->query("INSERT INTO reports (video_id, reporter_id, weight) VALUES ($video_id, $user_id, $weight)");
// Suma wag
$res = $conn->query("SELECT SUM(weight) as suma FROM reports WHERE video_id=$video_id AND status='pending'");
$suma = $res->fetch_assoc()['suma'];
if ($suma >= 20) {
    $conn->query("UPDATE videos SET status='pending' WHERE id=$video_id");
}
header("Location: view.php?id=$video_id");
