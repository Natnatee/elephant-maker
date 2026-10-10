import Link from "next/link";
import Image from "next/image";
import { Icon } from "@/components/icons";
import { ProjectExplorer } from "@/components/project-explorer";
import { getProjects, getProfileById, getProjectTags } from "@/lib/data";

export default function Home() {
  const projects = getProjects().map((project) => ({
    ...project,
    ownerName: getProfileById(project.ownerId)?.name ?? "Maker",
    tags: getProjectTags(project.id).map((tag) => tag.name),
  }));
  return (
    <main>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="eyebrow hero-eyebrow">
              <span className="little-dot" />
              พื้นที่ของคนชอบลงมือทำ
            </div>
            <h1>
              ไอเดียของคุณ
              <br />
              อาจเป็น<span className="highlight-word">คำตอบ</span>
              <br />
              ของใครอีกคน<span className="orange-period">.</span>
            </h1>
            <p>
              รวมโปรเจกต์ DIY ที่เริ่มจากปัญหาจริง
              <br className="desktop-break" /> มีคู่มือ อุปกรณ์
              และไฟล์ให้ทำตามในที่เดียว
            </p>
            <div className="hero-buttons">
              <Link className="button primary" href="/#explore">
                หาโปรเจกต์ที่ใช่ <Icon name="arrow" />
              </Link>
              <Link className="button hero-secondary" href="/submit">
                แบ่งปันสิ่งที่คุณทำ <Icon name="plus" size={18} />
              </Link>
            </div>
            <div className="hero-proof">
              <div className="proof-icons">
                <Icon name="book" size={17} />
                <Icon name="chip" size={17} />
                <Icon name="link" size={17} />
              </div>
              <span>
                คู่มือเป็นขั้นตอน <b>·</b> ไฟล์ครบในหน้าเดียว <b>·</b> แชร์ง่าย
              </span>
            </div>
          </div>
          <div className="hero-art" aria-label="ภาพประกอบแนวคิดเครื่องมือ DIY">
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <div className="hero-art-label">
              <span className="little-dot" />
              FROM AN IDEA TO SOMETHING REAL
            </div>
            <div className="featured-visual">
              <Image
                src="/images/kline.svg"
                alt="ภาพวาดเครื่องมืออ่านข้อมูลและบอร์ดอิเล็กทรอนิกส์"
                width={640}
                height={440}
                preload
                className="hero-device"
                unoptimized
              />
              <div className="visual-caption">
                <span className="mini-chip">
                  <Icon name="chip" size={14} /> ESP32
                </span>
                <span>ทำเองได้ เริ่มทีละขั้น</span>
              </div>
            </div>
            <div className="floating-note note-one">
              <span className="note-icon">
                <Icon name="check" />
              </span>
              <div>
                <strong>ไม่ต้องเริ่มจากศูนย์</strong>
                <small>มีคู่มือช่วยพาไปทีละขั้น</small>
              </div>
            </div>
            <div className="floating-note note-two">
              <Icon name="spark" size={20} />
              <span>สร้างแล้ว อย่าเก็บไว้คนเดียว</span>
            </div>
            <div className="hero-art-bottom">
              MADE BY MAKERS. BUILT FOR EVERYONE.<span>↗</span>
            </div>
          </div>
        </div>
      </section>
      <section className="value-strip">
        <div className="container value-strip-inner">
          <span>
            <Icon name="book" />
            อ่านง่าย ทำตามทีละขั้น
          </span>
          <span>
            <Icon name="chip" />
            ตั้งแต่ 3D Print ถึง ESP32
          </span>
          <span>
            <Icon name="link" />
            ฝากครั้งเดียว แชร์ได้ทุกกลุ่ม
          </span>
          <span className="prototype-label">กำลังทดลอง · ข้อมูลตัวอย่าง</span>
        </div>
      </section>
      <ProjectExplorer projects={projects} />
      <section className="container maker-section">
        <div className="maker-banner">
          <div>
            <p className="eyebrow">GOOD IDEAS DESERVE TO BE SHARED</p>
            <h2>
              ทำอะไรเจ๋ง ๆ อยู่?
              <br />
              ให้คนอื่นได้ลองทำด้วยสิ
            </h2>
            <p>
              ไม่ต้องทำเว็บเอง รวมคู่มือและไฟล์ไว้ที่นี่
              <br />
              แล้วเอาลิงก์กับภาพไปแชร์ในกลุ่มของคุณ
            </p>
            <Link href="/submit" className="button primary">
              ฝากผลงานแรกของคุณ <Icon name="arrow" />
            </Link>
          </div>
          <ol className="maker-process">
            <li>
              <span>01</span>
              <div>
                <strong>เล่าไอเดียของคุณ</strong>
                <p>ช่วยแก้ปัญหาอะไร ใครเอาไปใช้ได้</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>เติมคู่มือและไฟล์</strong>
                <p>บอกสิ่งที่ต้องเตรียมและขั้นตอนให้ครบ</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>พร้อมแชร์ออกไป</strong>
                <p>หน้าตัวอย่างมีลิงก์และภาพสำหรับแชร์</p>
              </div>
            </li>
          </ol>
        </div>
      </section>
    </main>
  );
}
