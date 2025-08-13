<?php
include 'db.php';
$cat = $_GET['name'];
$res = $conn->query("SELECT id, title FROM videos WHERE category='$cat' AND status='ready'");
while ($row = $res->fetch_assoc()) {
    echo "<a href='videos/view.php?id={$row['id']}'>{$row['title']}</a><br>";
}
?>
