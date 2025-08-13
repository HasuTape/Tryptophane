<?php
include '../db.php';
include '../jwt.php';

if (!isset($_COOKIE['token']) || !($user_id = verify_jwt($_COOKIE['token']))) {
    header("Location: ../auth/login.php");
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $title = $_POST['title'];
    $desc = $_POST['description'];
    $cat = $_POST['category'];
    // Upload pliku
    $target_dir = "../uploads/";
    if (!is_dir($target_dir)) mkdir($target_dir);
    $target_file = $target_dir . basename($_FILES["video"]["name"]);
    if (move_uploaded_file($_FILES["video"]["tmp_name"], $target_file)) {
        $stmt = $conn->prepare("INSERT INTO videos (owner_id, category, title, description, status) VALUES (?,?,?,?, 'processing')");
        $stmt->bind_param("isss", $user_id, $cat, $title, $desc);
        $stmt->execute();
        echo "Film przesłany! (Transkodowanie w tle)";
    } else {
        echo "Błąd uploadu!";
    }
}
?>
<form method="POST" enctype="multipart/form-data">
    Tytuł: <input name="title" required><br>
    Opis: <input name="description"><br>
    Kategoria:
    <select name="category">
        <option>Biologia</option>
        <option>Chemia</option>
        <option>Fizyka</option>
        <option>Matematyka</option>
    </select><br>
    Plik video: <input type="file" name="video" required><br>
    <button type="submit">Wyślij</button>
</form>
