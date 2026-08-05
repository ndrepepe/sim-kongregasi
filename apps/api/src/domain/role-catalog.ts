import { AppRole } from '../auth/auth.types';

export const ROLE_NAMES:AppRole[]=['SUPER_ADMIN','PIMPINAN','DEWAN','SUPERIOR_LOCAL','SEKRETARIS','BENDAHARA','MAGISTRA','KESEHATAN','ARSIPARIS','SAFEGUARDING','AUDITOR','ADMIN_TI','SUSTER','UNIT_ADMIN','VIEWER'];

export const PERMISSIONS=[
  {key:'dashboard.view',label:'Melihat dashboard sesuai scope',module:'Beranda'},
  {key:'member.directory',label:'Melihat direktori anggota terbatas',module:'Anggota'},
  {key:'member.manage',label:'Mengelola master data anggota',module:'Anggota'},
  {key:'member.verify',label:'Memverifikasi profil anggota',module:'Anggota'},
  {key:'organization.manage',label:'Mengelola struktur dan governance',module:'Organisasi'},
  {key:'assignment.manage',label:'Mengelola penugasan dan mutasi',module:'Penugasan'},
  {key:'formation.manage',label:'Mengelola formasi yang ditugaskan',module:'Formasi'},
  {key:'health.manage',label:'Mengelola kesehatan dan klaim',module:'Kesehatan'},
  {key:'finance.manage',label:'Mengelola keuangan entitas',module:'Keuangan'},
  {key:'archive.manage',label:'Mengelola arsip sesuai klasifikasi',module:'Arsip'},
  {key:'safeguarding.case',label:'Mengakses kasus yang ditugaskan',module:'Safeguarding'},
  {key:'workflow.approve',label:'Memeriksa dan menyetujui workflow',module:'Workflow'},
  {key:'audit.read',label:'Membaca audit sesuai engagement',module:'Audit'},
  {key:'identity.manage',label:'Mengelola lifecycle akun',module:'Identitas'},
  {key:'self.profile',label:'Melihat profil sendiri',module:'Mandiri'},
] as const;

type Definition={label:string;scope:string;limitation:string;permissions:string[];focus:string[];legacy?:boolean};
const common=['dashboard.view','member.directory'];
export const ROLE_DEFINITIONS:Record<AppRole,Definition>={
  SUPER_ADMIN:{label:'Super Admin',scope:'Seluruh organisasi',limitation:'Administrasi sistem; akses sensitif tetap harus mengikuti penugasan dan audit.',permissions:PERMISSIONS.map(p=>p.key),focus:['Kelola akun dan scope','Pantau keamanan dan audit','Konfigurasi sistem']},
  PIMPINAN:{label:'Pimpinan Umum / Provinsi',scope:'Organisasi dan unit di bawah mandat',limitation:'Kesehatan rinci dan safeguarding hanya bila ditugaskan.',permissions:[...common,'member.manage','member.verify','organization.manage','assignment.manage','workflow.approve','audit.read'],focus:['Keputusan mutasi','Kualitas data anggota','Persetujuan dan laporan']},
  DEWAN:{label:'Anggota Dewan',scope:'Agenda dan keputusan sesuai mandat',limitation:'Tidak otomatis mengedit data operasional.',permissions:[...common,'workflow.approve','audit.read'],focus:['Agenda dewan','Usulan menunggu review','Keputusan dan tindak lanjut']},
  SUPERIOR_LOCAL:{label:'Superior Lokal',scope:'Satu komunitas / rumah',limitation:'Tidak melihat komunitas lain atau evaluasi formasi rahasia.',permissions:[...common,'member.manage','assignment.manage','workflow.approve'],focus:['Anggota komunitas','Laporan rumah','Penugasan lokal']},
  SEKRETARIS:{label:'Sekretaris',scope:'Organisasi sesuai penempatan',limitation:'Tidak membuka data kesehatan atau formasi rahasia.',permissions:[...common,'member.manage','member.verify','organization.manage','assignment.manage','archive.manage'],focus:['Verifikasi anggota','SK dan surat','Arsip dan struktur']},
  BENDAHARA:{label:'Ekonom / Bendahara',scope:'Entitas keuangan yang ditempatkan',limitation:'Tidak melihat diagnosis; identitas klaim dibatasi.',permissions:[...common,'finance.manage','workflow.approve'],focus:['Jurnal dan rekonsiliasi','Anggaran','Tutup buku']},
  MAGISTRA:{label:'Magistra',scope:'Formandi yang ditugaskan',limitation:'Tidak mengakses keuangan atau isi pendampingan rohani.',permissions:[...common,'formation.manage','workflow.approve'],focus:['Tahap formasi','Evaluasi administratif','Keputusan formasi']},
  KESEHATAN:{label:'Petugas Kesehatan',scope:'Anggota dan kasus sesuai tugas',limitation:'Tidak mengakses evaluasi formasi atau keuangan umum.',permissions:[...common,'health.manage'],focus:['Kontrol kesehatan','Kelengkapan klaim','Tindak lanjut perawatan']},
  ARSIPARIS:{label:'Arsiparis / Kronikus',scope:'Seri dan klasifikasi arsip yang diizinkan',limitation:'Akses isi dibatasi menurut klasifikasi.',permissions:[...common,'archive.manage'],focus:['Dokumen dan retensi','Kronik','Publikasi terkontrol']},
  SAFEGUARDING:{label:'Safeguarding Officer',scope:'Kasus yang ditugaskan',limitation:'Per-case access; tidak terlihat oleh admin umum.',permissions:['dashboard.view','safeguarding.case'],focus:['Kasus yang ditugaskan','Tenggat tindak lanjut','Review akses kasus']},
  AUDITOR:{label:'Auditor',scope:'Engagement dan periode yang ditetapkan',limitation:'Read-only; ekspor diawasi dan berbatas waktu.',permissions:[...common,'audit.read'],focus:['Audit trail','Temuan kontrol','Batas masa engagement']},
  ADMIN_TI:{label:'Admin TI',scope:'Konfigurasi teknis dan lifecycle akun',limitation:'Tidak otomatis membaca isi sensitif.',permissions:['dashboard.view','identity.manage','audit.read'],focus:['Akun dan penguncian','Health check','Backup dan keamanan']},
  SUSTER:{label:'Suster Anggota',scope:'Profil sendiri dan direktori terbatas',limitation:'Perubahan data melalui permintaan koreksi.',permissions:[...common,'self.profile'],focus:['Profil sendiri','Kalender','Direktori dan pengumuman']},
  UNIT_ADMIN:{label:'Admin Unit (legacy)',scope:'Satu unit organisasi',limitation:'Dipertahankan untuk kompatibilitas; gunakan Superior Lokal.',permissions:[...common,'member.manage','assignment.manage'],focus:['Data unit'],legacy:true},
  VIEWER:{label:'Viewer (legacy)',scope:'Data umum sesuai organisasi',limitation:'Read-only; gunakan role bisnis yang lebih spesifik.',permissions:common,focus:['Ringkasan'],legacy:true},
};
