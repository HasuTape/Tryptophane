<?php
include '../db.php';
include '../jwt.php';

$id = intval($_GET['id']);
$res = $conn->query("SELECT v.*, u.email FROM videos v JOIN users u ON v.owner_id=u.id WHERE v.id=$id");
if (!$row = $res->fetch_assoc()) die("Nie znaleziono filmu!");

echo "<h2>{$row['title']}</h2>";
echo "<p>{$row['description']}</p>";
echo "<small>Autor: {$row['email']}</small><br>";
echo "<video id='player' controls width='480'><source src='../uploads/sample.mp4' type='video/mp4'></video><br>"; // uproszczone

echo "<form method='POST' action='like.php'><input type='hidden' name='id' value='$id'><button>Like</button></form>";
echo "<form method='POST' action='dislike.php'><input type='hidden' name='id' value='$id'><button>Dislike</button></form>";
echo "<form method='POST' action='check.php'><input type='hidden' name='id' value='$id'><button>Check</button></form>";
?>
<a href="index.php">Powrót do listy</a>
