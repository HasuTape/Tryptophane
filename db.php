<?php
$host = 'sql101.infinityfree.com';
$db   = 'if0_39694591_scitube';
$user = 'if0_39694591';
$pass = 'gzPPLaw8R6WN';

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
    die("Błąd połączenia: " . $conn->connect_error);
}
?>
