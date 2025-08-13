<?php
include '../db.php';
$res = $conn->query("SELECT r.id, v.title, u.email, r.weight, r.status FROM reports r JOIN videos v ON r.video_id=v.id JOIN users u ON r.reporter_id=u.id WHERE r.status='pending'");
while ($row = $res->fetch_assoc()) {
    echo "Film: {$row['title']} | Zgłaszający: {$row['email']} | Waga: {$row['weight']} | <a href='confirm.php?id={$row['id']}'>Potwierdź</a> | <a href='reject.php?id={$row['id']}'>Odrzuć</a><br>";
}
?>
