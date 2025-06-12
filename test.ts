export interface Data {
  ontherId: number;
  vnid?: string;
  title: Title[];
  onthermeidia: Onthermeidia[];
}

interface Title {
  title: string; // 标题
  lang: string; // 标题语言
}
interface Onthermeidia {
  meidiaUrl: string; // 媒体链接
  type: string; // 媒体类型
  ThumbHash: string; // ThumbHash 占位图 base64
  Hash: string; // 文件哈希（唯一性去重）
  Cover: number; // 1 为封面，0 为否
}
