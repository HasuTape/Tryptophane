<?php
include '../db.php';
$res = $conn->query("SELECT v.id, v.title, v.category, v.status, u.email FROM videos v JOIN users u ON v.owner_id=u.id WHERE v.status IN ('ready','pending')");
while ($row = $res->fetch_assoc()) {
    echo "<a href='view.php?id={$row['id']}'>{$row['title']}</a> ({$row['category']}) - {$row['status']}<br>";
}
?>
<a href="../profile.php">Powrót do profilu</a>
