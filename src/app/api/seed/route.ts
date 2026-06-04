import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST() {
  try {
    // Create roles
    const roleNames = [
      'SUPER_ADMIN',
      'ADMIN',
      'MODERATEUR',
      'FORMATEUR',
      'MENTOR',
      'VOLONTAIRE',
      'UTILISATEUR',
      'INTERVENANT_URGENCE',
    ];

    const roles: Record<string, string> = {};
    for (const name of roleNames) {
      const role = await db.role.upsert({
        where: { name },
        update: {},
        create: {
          name,
          description: `Role: ${name}`,
        },
      });
      roles[name] = role.id;
    }

    // Create super admin user (blunaantoine@gmail.com)
    const superAdminPassword = await hashPassword('admin123');
    const admin = await db.user.upsert({
      where: { email: 'blunaantoine@gmail.com' },
      update: { roleId: roles.SUPER_ADMIN, isVerified: true },
      create: {
        email: 'blunaantoine@gmail.com',
        name: 'Admin WEDS',
        password: superAdminPassword,
        phone: '+228 91 91 91 91',
        location: 'Lomé, Togo',
        roleId: roles.SUPER_ADMIN,
        isVerified: true,
      },
    });

    // Create regular user
    const userPassword = await hashPassword('user123');
    const regularUser = await db.user.upsert({
      where: { email: 'user@weds.togo' },
      update: {},
      create: {
        email: 'user@weds.togo',
        name: 'Ami Togo',
        password: userPassword,
        phone: '+228 91 00 00 00',
        location: 'Sokodé, Togo',
        roleId: roles.UTILISATEUR,
        isVerified: true,
      },
    });

    // Create formateur user
    const formateurPassword = await hashPassword('formateur123');
    const formateur = await db.user.upsert({
      where: { email: 'formateur@weds.togo' },
      update: {},
      create: {
        email: 'formateur@weds.togo',
        name: 'Kofi Mensah',
        password: formateurPassword,
        phone: '+228 92 00 00 00',
        location: 'Kara, Togo',
        roleId: roles.FORMATEUR,
        isVerified: true,
      },
    });

    // Create volunteer user
    const volunteerPassword = await hashPassword('volunteer123');
    const volunteer = await db.user.upsert({
      where: { email: 'volunteer@weds.togo' },
      update: {},
      create: {
        email: 'volunteer@weds.togo',
        name: 'Afi Lawson',
        password: volunteerPassword,
        phone: '+228 93 00 00 00',
        location: 'Atakpamé, Togo',
        roleId: roles.VOLONTAIRE,
        isVerified: true,
      },
    });

    // Courses will be added by the admin through the platform
    // No static courses are seeded

    // Create sample opportunities
    const opportunityData = [
      {
        title: 'Stage en Médiation Communautaire',
        description:
          'Stage de 6 mois en médiation communautaire avec une ONG internationale à Lomé.',
        type: 'stage',
        organization: 'ONG Paix et Développement',
        location: 'Lomé, Togo',
        deadline: '2025-09-30',
        salary: 'Indemnité de stage',
        requirements: 'Formation en médiation ou sciences sociales',
        contactEmail: 'stage@paixdev.tg',
        published: true,
      },
      {
        title: 'Emploi: Coordinateur de Programme',
        description:
          'Recherche coordinateur de programme pour la gestion des activités de formation dans la région des Plateaux.',
        type: 'emploi',
        organization: 'WEEK-END SCHOOL DIGITAL',
        location: 'Atakpamé, Togo',
        deadline: '2025-08-15',
        salary: '150 000 - 250 000 FCFA/mois',
        requirements: 'Diplôme universitaire, 3 ans d\'expérience en gestion de projet',
        contactEmail: 'rh@weds.togo',
        published: true,
      },
      {
        title: 'Bourse d\'Études en Leadership',
        description:
          'Bourse complète pour un programme de leadership et entrepreneuriat social au Togo.',
        type: 'bourse',
        organization: 'Fondation pour l\'Éducation',
        location: 'Kara, Togo',
        deadline: '2025-10-01',
        requirements: 'Être âgé de 18-35 ans, résider au Togo',
        contactEmail: 'bourse@fondation.tg',
        published: true,
      },
      {
        title: 'Volontariat: Éducation Numérique',
        description:
          'Devenez volontaire pour enseigner les compétences numériques dans les communautés rurales.',
        type: 'volontariat',
        organization: 'Digital Togo',
        location: 'Sokodé, Togo',
        deadline: '2025-12-31',
        requirements: 'Connaissances en informatique, motivation et engagement',
        contactEmail: 'volontaire@digitaltogo.tg',
        published: true,
      },
    ];

    for (const data of opportunityData) {
      const existing = await db.opportunity.findFirst({
        where: { title: data.title },
      });
      if (!existing) {
        await db.opportunity.create({ data });
      }
    }

    // Create sample mentors
    const mentorUsers = [
      {
        email: 'mentor.amede@weds.togo',
        name: 'Amede Koffi',
        expertise: 'Médiation de conflits, Dialogue intercommunautaire',
        availability: 'Lundi-Vendredi, 9h-17h',
        experience: '15 ans d\'expérience en médiation communautaire au Togo et en Afrique de l\'Ouest',
      },
      {
        email: 'mentor.esi@weds.togo',
        name: 'Esi Agbéko',
        expertise: 'Entrepreneuriat, Gestion financière',
        availability: 'Mardi et Jeudi, 14h-18h',
        experience: 'Fondatrice de deux entreprises sociales, formatrice en entrepreneuriat',
      },
      {
        email: 'mentor.kodjo@weds.togo',
        name: 'Kodjo Adjo',
        expertise: 'Compétences numériques, Développement web',
        availability: 'Lundi-Mercredi, 10h-15h',
        experience: 'Ingénieur informatique, 8 ans dans la formation numérique',
      },
    ];

    for (const m of mentorUsers) {
      const existingMentorUser = await db.user.findUnique({
        where: { email: m.email },
      });
      if (!existingMentorUser) {
        const mPassword = await hashPassword('mentor123');
        const newMentorUser = await db.user.create({
          data: {
            email: m.email,
            name: m.name,
            password: mPassword,
            location: 'Lomé, Togo',
            roleId: roles.MENTOR,
            isVerified: true,
          },
        });
        await db.mentor.create({
          data: {
            userId: newMentorUser.id,
            expertise: m.expertise,
            availability: m.availability,
            experience: m.experience,
            rating: 4.5 + Math.random() * 0.5,
          },
        });
      }
    }

    // Create sample community posts
    const postData = [
      {
        title: 'Bienvenue sur la communauté WEDS!',
        content:
          'Nous sommes ravis de vous accueillir sur la plateforme WEEK-END SCHOOL DIGITAL. Ici, vous pouvez partager vos expériences, poser des questions, et échanger avec d\'autres membres de la communauté. Ensemble, construisons la paix par l\'éducation!',
        category: 'general',
        userId: admin.id,
        pinned: true,
      },
      {
        title: 'Témoignage: Comment la médiation a sauvé mon village',
        content:
          'Il y a deux ans, notre village était divisé par un conflit foncier. Grâce aux techniques de médiation apprises sur WEDS, j\'ai pu faciliter le dialogue entre les parties. Aujourd\'hui, nous vivons en paix et collaborons même sur des projets agricoles communs.',
        category: 'temoignage',
        userId: regularUser.id,
        pinned: false,
      },
      {
        title: 'Conseils pour réussir votre formation en ligne',
        content:
          'Voici quelques conseils pour tirer le meilleur parti de vos cours sur WEDS:\n1. Fixez un horaire régulier d\'étude\n2. Participez aux discussions communautaires\n3. N\'hésitez pas à demander de l\'aide aux mentors\n4. Appliquez ce que vous apprenez dans votre quotidien\n5. Célébrez vos progrès!',
        category: 'conseil',
        userId: formateur.id,
        pinned: false,
      },
    ];

    for (const data of postData) {
      const existingPost = await db.communityPost.findFirst({
        where: { title: data.title },
      });
      if (!existingPost) {
        await db.communityPost.create({ data });
      }
    }

    // Create sample groups
    const groupData = [
      { name: 'Médiateurs Communautaires', description: 'Groupe des médiateurs certifiés', category: 'paix', icon: '🕊️' },
      { name: 'Entrepreneurs Togo', description: 'Réseau des entrepreneurs formés sur WEDS', category: 'entrepreneuriat', icon: '💼' },
      { name: 'Volontaires Numériques', description: 'Communauté des volontaires en éducation numérique', category: 'numerique', icon: '💻' },
      { name: 'Jeunes Leaders', description: 'Groupe des jeunes leaders communautaires', category: 'leadership', icon: '🌟' },
    ];

    for (const data of groupData) {
      const existingGroup = await db.group.findFirst({
        where: { name: data.name },
      });
      if (!existingGroup) {
        const group = await db.group.create({ data });

        // Add admin and some users to groups
        for (const memberData of [
          { userId: admin.id, groupId: group.id, role: 'admin' },
          { userId: regularUser.id, groupId: group.id, role: 'member' },
        ]) {
          const existingMember = await db.groupMember.findUnique({
            where: { userId_groupId: { userId: memberData.userId, groupId: memberData.groupId } },
          });
          if (!existingMember) {
            await db.groupMember.create({ data: memberData });
          }
        }
      }
    }

    // Create badges
    const badgeData = [
      { name: 'Pionnier de la Paix', description: 'Premier cours de médiation complété', icon: '🕊️', category: 'paix' },
      { name: 'Apprenant Dédié', description: '5 cours complétés', icon: '📚', category: 'apprentissage' },
      { name: 'Mentor Bienveillant', description: 'Aide 10 apprenants', icon: '🤝', category: 'mentorat' },
      { name: 'Citoyen Actif', description: '10 signalements communautaires', icon: '🏘️', category: 'communaute' },
      { name: 'Héros d\'Urgence', description: 'Première intervention SOS', icon: '🦸', category: 'urgence' },
      { name: 'Expert Numérique', description: 'Cours de compétences numériques complété', icon: '💻', category: 'numerique' },
      { name: 'Entrepreneur Social', description: 'Formation en entrepreneuriat complétée', icon: '💡', category: 'entrepreneuriat' },
      { name: 'Ambassadeur WEDS', description: 'Parrainage de 5 nouveaux membres', icon: '⭐', category: 'communaute' },
    ];

    for (const data of badgeData) {
      const existingBadge = await db.badge.findFirst({
        where: { name: data.name },
      });
      if (!existingBadge) {
        await db.badge.create({ data });
      }
    }

    // Create some notifications for the regular user
    const notifData = [
      {
        userId: regularUser.id,
        title: 'Bienvenue sur WEDS!',
        message: 'Votre compte a été créé avec succès. Explorez les cours et opportunités disponibles.',
        type: 'system',
      },
      {
        userId: regularUser.id,
        title: 'Nouveau cours disponible',
        message: 'Un nouveau cours "Médiation et Résolution de Conflits" est maintenant disponible.',
        type: 'course',
        link: '/courses',
      },
      {
        userId: regularUser.id,
        title: 'Opportunité de bourse',
        message: 'Une nouvelle bourse d\'études en leadership est disponible. Postulez avant le 1er octobre!',
        type: 'opportunity',
        link: '/opportunities',
      },
    ];
    for (const nd of notifData) {
      await db.notification.create({ data: nd });
    }

    return NextResponse.json({
      message: 'Database seeded successfully',
      data: {
        roles: roleNames.length,
        users: 4,
        courses: 0,
        opportunities: opportunityData.length,
        mentors: mentorUsers.length,
        posts: postData.length,
        groups: groupData.length,
        badges: badgeData.length,
      },
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
