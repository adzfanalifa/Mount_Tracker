<?php
return [
    'db_host' => 'localhost',
    'db_name' => 'mount_tracker',
    'db_user' => 'root',
    'db_pass' => '',
    'jwt_secret' => 'GANTI_DENGAN_STRING_ACAK_PANJANG',
    'jwt_ttl' => 60 * 60 * 24 * 30, // token berlaku 30 hari
    'timezone' => 'Asia/Jakarta',
    'allowed_origin' => '*',
];
